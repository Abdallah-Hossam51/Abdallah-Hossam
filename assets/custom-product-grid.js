/**
 * Custom Product Grid
 * ---------------------------------------------------------------
 * Vanilla JS. No jQuery, no external libraries.
 *
 * Responsibilities:
 *  - Open a quick-view popup for a product selected in a grid card
 *  - Fetch product data from /products/{handle}.js (cached in-memory)
 *  - Render a dynamic variant picker (color swatches + size buttons)
 *  - Add the selected variant to the cart via /cart/add.js
 *  - Automatically add a "special" product when the shopper's
 *    selection resolves to a Black + Medium variant
 *
 * Public surface is intentionally empty on `window` - everything is
 * scoped inside the IIFE below. The only "global" side effect is the
 * DOMContentLoaded listener that calls init().
 * ---------------------------------------------------------------
 */
(function () {
  'use strict';

  /**
   * In-memory product cache shared by every grid instance on the page.
   * Prevents fetching the same /products/{handle}.js twice.
   * key: product handle -> value: parsed product JSON
   */
  var productCache = {};

  /**
   * In-flight request cache, so rapid double-clicks on the same
   * product don't trigger duplicate network requests.
   * key: product handle -> value: Promise<product>
   */
  var pendingRequests = {};

  /* ------------------------------------------------------------- */
  /* Utilities                                                      */
  /* ------------------------------------------------------------- */

  /**
   * Format an amount in cents into a display price string.
   * Falls back to a simple USD-style format if Shopify's currency
   * object isn't available on the page.
   */
  function formatMoney(cents) {
    var amount = (cents || 0) / 100;
    var currencyCode =
      (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';

    try {
      return new Intl.NumberFormat(document.documentElement.lang || 'en', {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'symbol',
      }).format(amount);
    } catch (err) {
      return '$' + amount.toFixed(2);
    }
  }

  /** Basic HTML sanitizer for product descriptions (strips <script>/<style>). */
  function sanitizeHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = html || '';
    template.content.querySelectorAll('script, style').forEach(function (node) {
      node.remove();
    });
    return template.innerHTML;
  }

  /** True if a string looks like a "color" option name. */
  function isColorOption(name) {
    return /colou?r/i.test(name || '');
  }

  /**
   * Best-effort mapping of a color option value to a CSS color, used
   * only for the small swatch chip. Falls back to a neutral gray.
   */
  function guessCssColor(value) {
    var known = [
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange',
      'purple', 'pink', 'brown', 'gray', 'grey', 'navy', 'beige',
      'cream', 'gold', 'silver', 'khaki', 'olive', 'teal', 'maroon',
    ];
    var normalized = (value || '').toLowerCase().trim();
    for (var i = 0; i < known.length; i++) {
      if (normalized.indexOf(known[i]) !== -1) {
        return known[i] === 'grey' ? 'gray' : known[i];
      }
    }
    return '#cccccc';
  }

  /**
   * Fetch a product by handle, using the shared in-memory cache.
   * Returns a Promise<productJson>.
   */
  function fetchProduct(handle) {
    if (!handle) {
      return Promise.reject(new Error('Missing product handle'));
    }

    if (productCache[handle]) {
      return Promise.resolve(productCache[handle]);
    }

    if (pendingRequests[handle]) {
      return pendingRequests[handle];
    }

    var request = fetch('/products/' + handle + '.js', {
      headers: { Accept: 'application/json' },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Unable to load product "' + handle + '"');
        }
        return response.json();
      })
      .then(function (product) {
        productCache[handle] = product;
        delete pendingRequests[handle];
        return product;
      })
      .catch(function (err) {
        delete pendingRequests[handle];
        throw err;
      });

    pendingRequests[handle] = request;
    return request;
  }

  /**
   * Returns true if a variant's option values include both a value
   * containing "black" and a value containing "medium" (case
   * insensitive). Works regardless of which option index color/size
   * live in.
   */
  function isBlackMediumVariant(variant) {
    if (!variant || !Array.isArray(variant.options)) return false;

    var hasBlack = false;
    var hasMedium = false;

    variant.options.forEach(function (value) {
      var normalized = (value || '').toLowerCase();
      if (normalized.indexOf('black') !== -1) hasBlack = true;
      if (normalized.indexOf('medium') !== -1 || normalized === 'm') hasMedium = true;
    });

    return hasBlack && hasMedium;
  }

  /**
   * Given a product JSON object, find its variant whose options
   * contain both "black" and "medium". Returns null if none exists.
   */
  function findBlackMediumVariant(product) {
    if (!product || !Array.isArray(product.variants)) return null;
    for (var i = 0; i < product.variants.length; i++) {
      if (isBlackMediumVariant(product.variants[i])) {
        return product.variants[i];
      }
    }
    return null;
  }

  /**
   * Fallback handle used when the section's "Auto-add product" setting
   * hasn't been configured in the theme customizer. Shopify converts
   * "Soft Winter Jacket" to this handle by default; if your store uses
   * a different handle, either rename the product or set the picker
   * in the customizer (Section > Auto-add product) - which always
   * takes priority over this fallback.
   */
  var DEFAULT_SPECIAL_PRODUCT_HANDLE = 'dark-winter-jacket';

  /* ------------------------------------------------------------- */
  /* Grid controller factory - one per .custom-product-grid section */
  /* ------------------------------------------------------------- */

  function createGridController(sectionEl) {
    var grid = sectionEl.querySelector('[data-product-grid]');
    var modal = sectionEl.querySelector('[data-product-modal]');
    if (!grid || !modal) return;

    var specialHandle =
      sectionEl.getAttribute('data-special-product-handle') || DEFAULT_SPECIAL_PRODUCT_HANDLE;

    var els = {
      loading: modal.querySelector('[data-modal-loading]'),
      content: modal.querySelector('[data-modal-content]'),
      image: modal.querySelector('[data-modal-image]'),
      title: modal.querySelector('[data-modal-title]'),
      price: modal.querySelector('[data-modal-price]'),
      description: modal.querySelector('[data-modal-description]'),
      options: modal.querySelector('[data-modal-options]'),
      error: modal.querySelector('[data-modal-error]'),
      addBtn: modal.querySelector('[data-add-to-cart]'),
      addBtnLabel: modal.querySelector('[data-add-to-cart-label]'),
    };

    // Local (non-global) state for this modal instance only.
    var state = {
      product: null,
      selectedOptions: [], // parallel to product.options, e.g. ['Black', 'Medium']
      previouslyFocused: null,
    };

    /* --------------------------- Modal open/close --------------------------- */

    function openModal(handle) {
      state.previouslyFocused = document.activeElement;

      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      setLoading(true);
      showError('');

      fetchProduct(handle)
        .then(function (product) {
          state.product = product;
          state.selectedOptions = new Array(product.options.length).fill(null);
          renderProduct(product);
          renderVariants(product);
          updateVariant();
          setLoading(false);
        })
        .catch(function () {
          setLoading(false);
          showError('This product could not be loaded. Please try again.');
        });

      var closeBtn = modal.querySelector('.custom-product-modal__close');
      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      resetAddButton();

      if (state.previouslyFocused && typeof state.previouslyFocused.focus === 'function') {
        state.previouslyFocused.focus();
      }
    }

    function setLoading(isLoading) {
      els.loading.hidden = !isLoading;
      els.content.hidden = isLoading;
    }

    function showError(message) {
      if (!message) {
        els.error.hidden = true;
        els.error.textContent = '';
        return;
      }
      els.error.hidden = false;
      els.error.textContent = message;
    }

    /* --------------------------- Rendering --------------------------- */

    function renderProduct(product) {
      var featuredMedia = product.featured_image || (product.images && product.images[0]);
      els.image.src = featuredMedia || '';
      els.image.alt = product.title || '';
      els.title.textContent = product.title || '';
      els.description.innerHTML = sanitizeHtml(product.description);
      renderPrice(product.price);
    }

    function renderPrice(cents) {
      els.price.textContent = formatMoney(cents);
    }

    function renderVariants(product) {
      els.options.innerHTML = '';

      // Single-variant products with only the default "Title" option
      // don't need a picker.
      var hasRealOptions =
        product.options &&
        product.options.length > 0 &&
        !(product.options.length === 1 && product.options[0].toLowerCase() === 'title');

      if (!hasRealOptions) return;

      product.options.forEach(function (optionName, optionIndex) {
        var values = collectOptionValues(product, optionIndex);
        var group = document.createElement('div');
        group.className = 'cpg-option-group';

        var label = document.createElement('span');
        label.className = 'cpg-option-group__label';
        label.textContent = optionName;
        group.appendChild(label);

        var valuesWrap = document.createElement('div');
        valuesWrap.className = 'cpg-option-group__values';
        valuesWrap.setAttribute('role', 'group');
        valuesWrap.setAttribute('aria-label', optionName);

        var colorOption = isColorOption(optionName);

        if (colorOption) {
          valuesWrap.classList.add('cpg-option-group__values--color');
        }

        values.forEach(function (value) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'cpg-option-value' + (colorOption ? ' cpg-option-value--color' : '');
          btn.dataset.optionIndex = String(optionIndex);
          btn.dataset.value = value;
          btn.setAttribute('aria-pressed', 'false');

          if (colorOption) {
            btn.style.setProperty('--swatch-color', guessCssColor(value));
          }

          var text = document.createElement('span');
          text.textContent = value;
          btn.appendChild(text);

          btn.addEventListener('click', function () {
            selectOption(optionIndex, value);
          });

          valuesWrap.appendChild(btn);
        });

        group.appendChild(valuesWrap);
        els.options.appendChild(group);
      });
    }

    function collectOptionValues(product, optionIndex) {
      var seen = {};
      var values = [];
      product.variants.forEach(function (variant) {
        var value = variant.options[optionIndex];
        if (value && !seen[value]) {
          seen[value] = true;
          values.push(value);
        }
      });
      return values;
    }

    /* --------------------------- Selection logic --------------------------- */

    function selectOption(optionIndex, value) {
      state.selectedOptions[optionIndex] = value;
      syncOptionButtonStates();
      updateVariant();
    }

    function syncOptionButtonStates() {
      var buttons = els.options.querySelectorAll('.cpg-option-value');
      buttons.forEach(function (btn) {
        var index = Number(btn.dataset.optionIndex);
        var isSelected = state.selectedOptions[index] === btn.dataset.value;
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      });
      updateAvailableOptions();
    }

    /**
     * Disable option-value buttons that cannot lead to an available
     * variant given the currently selected values on other axes.
     */
    function updateAvailableOptions() {
      if (!state.product) return;

      var buttons = els.options.querySelectorAll('.cpg-option-value');
      buttons.forEach(function (btn) {
        var index = Number(btn.dataset.optionIndex);
        var value = btn.dataset.value;

        var candidate = state.selectedOptions.slice();
        candidate[index] = value;

        var matchExists = state.product.variants.some(function (variant) {
          return (
            variant.available &&
            candidate.every(function (selected, i) {
              return selected === null || selected === variant.options[i];
            })
          );
        });

        btn.disabled = !matchExists;
      });
    }

    function getSelectedVariant() {
      if (!state.product) return null;
      var complete = state.selectedOptions.every(function (value) {
        return value !== null;
      });
      if (!complete) return null;

      return (
        state.product.variants.filter(function (variant) {
          return state.selectedOptions.every(function (value, i) {
            return value === variant.options[i];
          });
        })[0] || null
      );
    }

    function updateVariant() {
      var variant = getSelectedVariant();

      if (variant) {
        renderPrice(variant.price);
        if (variant.featured_image && variant.featured_image.src) {
          els.image.src = variant.featured_image.src;
        } else if (variant.featured_image) {
          els.image.src = variant.featured_image;
        }
        els.addBtn.disabled = !variant.available;
        showError(variant.available ? '' : 'This combination is currently unavailable.');
      } else {
        els.addBtn.disabled = true;
      }

      updateAvailableOptions();
    }

    /* --------------------------- Add to cart --------------------------- */

    function resetAddButton() {
      els.addBtn.removeAttribute('data-state');
      els.addBtnLabel.textContent = 'Add to cart';
      var variant = getSelectedVariant();
      els.addBtn.disabled = !variant || !variant.available;
    }

    function setAddButtonState(newState) {
      els.addBtn.dataset.state = newState;
      if (newState === 'loading') {
        els.addBtnLabel.textContent = 'Adding\u2026';
        els.addBtn.disabled = true;
      } else if (newState === 'success') {
        els.addBtnLabel.textContent = 'Added!';
      } else if (newState === 'error') {
        els.addBtnLabel.textContent = 'Try again';
        els.addBtn.disabled = false;
      }
    }

    /**
     * Resolve the special "Black + Medium" variant of the section's
     * configured auto-add product, using the shared product cache.
     */
    function loadSpecialProduct() {
      if (!specialHandle) return Promise.resolve(null);
      return fetchProduct(specialHandle)
        .then(function (product) {
          var match = findBlackMediumVariant(product);
          if (!match) {
            console.warn(
              '[custom-product-grid] Auto-add product "' +
                specialHandle +
                '" has no Black + Medium variant to add.'
            );
          }
          return match;
        })
        .catch(function () {
          console.warn(
            '[custom-product-grid] Could not load the auto-add product at handle "' +
              specialHandle +
              '". Set it explicitly via Section settings > Auto-add product in the theme customizer.'
          );
          return null;
        });
    }

    function addToCart() {
      var variant = getSelectedVariant();
      if (!variant || !variant.available) return;

      setAddButtonState('loading');
      showError('');

      var items = [{ id: variant.id, quantity: 1 }];

      var maybeSpecial = isBlackMediumVariant(variant) ? loadSpecialProduct() : Promise.resolve(null);

      maybeSpecial
        .then(function (specialVariant) {
          if (specialVariant && specialVariant.id !== variant.id) {
            items.push({ id: specialVariant.id, quantity: 1 });
          }

          return fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ items: items }),
          });
        })
        .then(function (response) {
          if (!response.ok) {
            return response.json().then(function (data) {
              throw new Error((data && data.description) || 'Could not add to cart.');
            });
          }
          return response.json();
        })
        .then(function () {
          setAddButtonState('success');
          document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
          window.setTimeout(closeModal, 900);
        })
        .catch(function (err) {
          setAddButtonState('error');
          showError(err && err.message ? err.message : 'Could not add to cart. Please try again.');
        });
    }

    /* --------------------------- Event wiring --------------------------- */

    grid.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-product-handle]');
      if (!trigger) return;
      var handle = trigger.getAttribute('data-product-handle');
      if (handle) openModal(handle);
    });

    modal.addEventListener('click', function (event) {
      if (event.target.closest('[data-modal-close]')) {
        closeModal();
      }
    });

    modal.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeModal();
    });

    els.addBtn.addEventListener('click', addToCart);
  }

  /* ------------------------------------------------------------- */
  /* Init                                                           */
  /* ------------------------------------------------------------- */

  function init() {
    var sections = document.querySelectorAll('[data-section-type="custom-product-grid"]');
    sections.forEach(createGridController);

    // Support sections being (re)loaded via the Shopify theme editor.
    document.addEventListener('shopify:section:load', function (event) {
      var section = event.target.querySelector('[data-section-type="custom-product-grid"]');
      if (section) createGridController(section);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
