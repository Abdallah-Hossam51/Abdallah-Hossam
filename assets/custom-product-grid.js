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

  async function loadSoftWinterProduct() {

    try {

      const response = await fetch("/products/soft-winter-jacket.js");

      if (!response.ok) return;

      const jacket = await response.json();

      if (jacket.variants.length) {

        softWinterVariantId = jacket.variants[0].id;

      }

    } catch (error) {

      console.error(error);

    }

  }

  loadSoftWinterProduct();

  document.querySelectorAll(".product-popup-btn").forEach(button => {

    button.addEventListener("click", async () => {

      try {

        const handle = button.dataset.handle;

        const response = await fetch(`/products/${handle}.js`);

        if (!response.ok) throw new Error("Product not found");

        const product = await response.json();

        currentProduct = product;

        selectedVariant = product.variants[0];

        renderModal(product);

        renderVariants(product);

        modal.classList.add("active");

      }

      catch(error){

        console.error(error);

      }

    });

  });

  function renderModal(product){

    modalImage.src = product.featured_image;

    modalImage.alt = product.title;

    modalTitle.textContent = product.title;

    modalPrice.textContent =
      `$${(product.price / 100).toFixed(2)}`;

    modalDescription.innerHTML = product.description;

  }

  function renderVariants(product){

    variantContainer.innerHTML = "";

    product.options.forEach((option,index)=>{

      const wrapper=document.createElement("div");

      const label=document.createElement("label");

      label.textContent=option;

      const select=document.createElement("select");

      const values=[
        ...new Set(
          product.variants.map(
            v=>v[`option${index+1}`]
          )
        )
      ];

      values.forEach(value=>{

        const option=document.createElement("option");

        option.value=value;

        option.textContent=value;

        select.appendChild(option);

      });

      select.addEventListener("change",()=>{

        updateVariant();

      });

      wrapper.appendChild(label);

      wrapper.appendChild(select);

      variantContainer.appendChild(wrapper);

    });

    updateVariant();

  }