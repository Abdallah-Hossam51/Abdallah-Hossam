(function () {
  'use strict';

  var productCache = {};
  var pendingRequests = {};

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

  function sanitizeHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = html || '';
    template.content.querySelectorAll('script, style').forEach(function (node) {
      node.remove();
    });
    return template.innerHTML;
  }

  function isColorOption(name) {
    return /colou?r/i.test(name || '');
  }
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

  function findBlackMediumVariant(product) {
    if (!product || !Array.isArray(product.variants)) return null;
    for (var i = 0; i < product.variants.length; i++) {
      if (isBlackMediumVariant(product.variants[i])) {
        return product.variants[i];
      }
    }
    return null;
  }

  var DEFAULT_SPECIAL_PRODUCT_HANDLE = 'dark-winter-jacket';
  var CART_SECTION_IDS = ['cart-icon-bubble', 'cart-notification', 'cart-drawer', 'cart-live-region-text'];
  var CART_COUNT_SELECTORS = [
    '[data-cart-count]',
    '.cart-count',
    '.cart-count-bubble',
    '#cart-icon-bubble',
    '#CartCount',
    '#CartCount-mobile',
    '.js-cart-count',
  ];

  function fetchCart() {
    return fetch('/cart.js', { headers: { Accept: 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('Could not read cart');
      return response.json();
    });
  }

  function applySectionRenders(sections) {
    if (!sections) return;

    Object.keys(sections).forEach(function (id) {
      var target = document.getElementById(id);
      if (!target) return;

      var parsedDoc = new DOMParser().parseFromString(sections[id], 'text/html');
      var replacement = parsedDoc.getElementById(id);

      if (replacement) {
        target.outerHTML = replacement.outerHTML;
      } else {
        target.innerHTML = sections[id];
      }
    });
  }

  function updateCartCountBadges(cart) {
    var count = cart && typeof cart.item_count === 'number' ? cart.item_count : null;
    if (count === null) return;

    CART_COUNT_SELECTORS.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (el) {
        if (el.hasAttribute('data-cart-count') || el.matches('[data-cart-count]')) {
          el.setAttribute('data-cart-count', String(count));
        }

        if (!el.querySelector('svg') && !el.children.length) {
          el.textContent = String(count);
        }
        el.classList.toggle('is-visible', count > 0);
        if (el.hasAttribute('hidden') || el.style.display === 'none') {
          el.hidden = count === 0;
        }
      });
    });
  }

  function syncCartUi() {
    return fetchCart()
      .then(function (cart) {
        updateCartCountBadges(cart);
        document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { cart: cart } }));
        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: cart } }));
        return cart;
      })
      .catch(function () {
        return null;
      });
  }

  var toastEl = null;
  var toastTimeout = null;

  function showCartToast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'cpg-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }

    toastEl.textContent = message;
    toastEl.classList.add('cpg-toast--visible');

    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(function () {
      toastEl.classList.remove('cpg-toast--visible');
    }, 2400);
  }

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

    var state = {
      product: null,
      selectedOptions: [],
      previouslyFocused: null,
    };

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

          if (product.variants.length === 1) {
            state.selectedOptions = product.variants[0].options.slice();
          } else {
            state.selectedOptions = new Array(product.options.length).fill(null);
          }

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

      function getOptionName(option) {
        if (typeof option === 'string') return option;
        if (option && typeof option.name === 'string') return option.name;
        return 'Option';
      }

      var hasRealOptions =
        product.options &&
        product.options.length > 0 &&
        !(product.options.length === 1 && getOptionName(product.options[0]).toLowerCase() === 'title');

      if (!hasRealOptions) return;

      product.options.forEach(function (rawOption, optionIndex) {
        var optionName = getOptionName(rawOption);
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
      }

      syncAddButtonAvailability();
      updateAvailableOptions();
    }

    function syncAddButtonAvailability() {
      var variant = getSelectedVariant();
      els.addBtn.removeAttribute('data-state');

      if (!variant) {
        els.addBtnLabel.textContent = 'Select options';
        els.addBtn.disabled = true;
        showError('');
      } else if (!variant.available) {
        els.addBtnLabel.textContent = 'Sold out';
        els.addBtn.disabled = true;
        showError('This combination is currently unavailable.');
      } else {
        els.addBtnLabel.textContent = 'Add to cart';
        els.addBtn.disabled = false;
        showError('');
      }
    }

    function resetAddButton() {
      syncAddButtonAvailability();
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
            body: JSON.stringify({
              items: items,
              sections: CART_SECTION_IDS,
              sections_url: window.location.pathname,
            }),
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
        .then(function (data) {
          applySectionRenders(data && data.sections);
          setAddButtonState('success');
          return syncCartUi();
        })
        .then(function () {
          showCartToast('Added to cart');
          window.setTimeout(closeModal, 900);
        })
        .catch(function (err) {
          setAddButtonState('error');
          showError(err && err.message ? err.message : 'Could not add to cart. Please try again.');
        });
    }

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

  function init() {
    var sections = document.querySelectorAll('[data-section-type="custom-product-grid"]');
    sections.forEach(createGridController);

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