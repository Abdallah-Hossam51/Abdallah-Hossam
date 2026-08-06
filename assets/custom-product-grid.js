document.addEventListener("DOMContentLoaded", () => {

  const modal = document.getElementById("productModal");

  if (!modal) return;

  const modalImage = document.getElementById("modalImage");
  const modalTitle = document.getElementById("modalTitle");
  const modalPrice = document.getElementById("modalPrice");
  const modalDescription = document.getElementById("modalDescription");
  const variantContainer = document.getElementById("variantContainer");

  const closeBtn = document.querySelector(".modal-close");
  const overlay = document.querySelector(".modal-overlay");
  const addToCartBtn = document.getElementById("addToCartBtn");

  let currentProduct = null;
  let selectedVariant = null;
  let softWinterVariantId = null;

  async function loadSoftWinterVariant() {

    try {

      const response = await fetch("/products/soft-winter-jacket.js");

      if (!response.ok) return;

      const jacket = await response.json();

      if (jacket.variants.length > 0) {
        softWinterVariantId = jacket.variants[0].id;
      }

    } catch (error) {

      console.error(error);

    }

  }

  loadSoftWinterVariant();

  const popupButtons = document.querySelectorAll(".product-popup-btn");

  popupButtons.forEach(button => {

    button.addEventListener("click", async () => {

      try {

        const handle = button.dataset.handle;

        const response = await fetch(`/products/${handle}.js`);

        if (!response.ok) {
          throw new Error("Unable to load product");
        }

        const product = await response.json();

        currentProduct = product;

        selectedVariant = product.variants[0];

        renderProduct(product);

        renderVariantSelectors(product);

        modal.classList.add("active");

      }

      catch(error){

        console.error(error);

      }

    });

  });

  function renderProduct(product){

    modalImage.src = product.featured_image;

    modalImage.alt = product.title;

    modalTitle.textContent = product.title;

    modalPrice.textContent =
      `$${(selectedVariant.price / 100).toFixed(2)}`;

    modalDescription.innerHTML = product.description;

  }

  function renderVariantSelectors(product){

    variantContainer.innerHTML = "";

    product.options.forEach((optionName,index)=>{

      const wrapper = document.createElement("div");

      wrapper.className = "variant-group";

      const label = document.createElement("label");

      label.textContent = optionName;

      const select = document.createElement("select");

      const values = [

        ...new Set(

          product.variants.map(

            variant => variant[`option${index+1}`]

          )

        )

      ];

      values.forEach(value=>{

        const option = document.createElement("option");

        option.value = value;

        option.textContent = value;

        select.appendChild(option);

      });

      select.addEventListener("change",updateVariant);

      wrapper.appendChild(label);

      wrapper.appendChild(select);

      variantContainer.appendChild(wrapper);

    });

    updateVariant();

  }

  function updateVariant() {

    if (!currentProduct) return;

    const selects = [...variantContainer.querySelectorAll("select")];

    const selectedValues = selects.map(select => select.value);

    selectedVariant = currentProduct.variants.find(variant => {

      return selectedValues.every((value, index) => {

        return variant[`option${index + 1}`] === value;

      });

    });

    if (!selectedVariant) return;

    modalPrice.textContent =
      `$${(selectedVariant.price / 100).toFixed(2)}`;

    if (
      selectedVariant.featured_image &&
      selectedVariant.featured_image.src
    ) {
      modalImage.src = selectedVariant.featured_image.src;
    }

    updateAvailableOptions();

  }

  function updateAvailableOptions() {

    const selects = [...variantContainer.querySelectorAll("select")];

    selects.forEach((select, index) => {

      const previousValues = selects
        .slice(0, index)
        .map(s => s.value);

      [...select.options].forEach(option => {

        const exists = currentProduct.variants.some(variant => {

          if (!variant.available) return false;

          for (let i = 0; i < previousValues.length; i++) {

            if (variant[`option${i + 1}`] !== previousValues[i]) {

              return false;

            }

          }

          return variant[`option${index + 1}`] === option.value;

        });

        option.disabled = !exists;

      });

    });

  }

  addToCartBtn.addEventListener("click", async () => {

    if (!selectedVariant) return;

    const items = [];

    items.push({
      id: selectedVariant.id,
      quantity: 1
    });

    let color = "";
    let size = "";

    currentProduct.options.forEach((optionName, index) => {

      const value = selectedVariant[`option${index + 1}`];

      if (optionName.toLowerCase() === "color") {
        color = value;
      }

      if (optionName.toLowerCase() === "size") {
        size = value;
      }

    });

    if (
      color.toLowerCase() === "black" &&
      size.toLowerCase() === "medium" &&
      softWinterVariantId
    ) {

      items.push({
        id: softWinterVariantId,
        quantity: 1
      });

    }

    try {

      const response = await fetch("/cart/add.js", {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          items: items
        })

      });

      if (!response.ok) {

        throw new Error("Unable to add products");

      }

      modal.classList.remove("active");

      window.location.href = "/cart";

    }

    catch (error) {

      console.error(error);

    }

  });

  function closeModal() {

    modal.classList.remove("active");

  }

  closeBtn.addEventListener("click", closeModal);

  overlay.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {

    if (event.key === "Escape") {

      closeModal();

    }

  });

  const observer = new MutationObserver(() => {

    if (modal.classList.contains("active")) {

      document.body.style.overflow = "hidden";

    } else {

      document.body.style.overflow = "";

    }

  });

  observer.observe(modal, {
    attributes: true,
    attributeFilter: ["class"]
  });

});