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
  let softWinterVariantId = null;


(async () => {
  try {
    const response = await fetch("/products/soft-winter-jacket.js");

    if (!response.ok) return;

    const jacket = await response.json();

   
    softWinterVariantId = jacket.variants[0].id;

    console.log("Soft Winter Jacket Variant:", softWinterVariantId);

  } catch (e) {
    console.error("Failed to load Soft Winter Jacket", e);
  }
})();

  document.querySelectorAll(".product-popup-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const handle = button.dataset.handle;
        const response = await fetch(`/products/${handle}.js`);
        const product = await response.json();

        currentProduct = product;

        modal.classList.add("active");

        modalImage.src = product.featured_image;
        modalImage.alt = product.title;
        modalTitle.textContent = product.title;
        modalPrice.textContent = `$${(product.price / 100).toFixed(2)}`;
        modalDescription.innerHTML = product.description;

        buildVariantSelectors(product);

      } catch (error) {
        console.error(error);
      }
    });
  });

  function buildVariantSelectors(product) {
    variantContainer.innerHTML = "";

    product.options.forEach((optionName, index) => {
      const wrapper = document.createElement("div");

      const label = document.createElement("label");
      label.textContent = optionName;

      const select = document.createElement("select");

      const values = [...new Set(product.variants.map(v => v[`option${index + 1}`]))];

      values.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      wrapper.appendChild(label);
      wrapper.appendChild(select);
      variantContainer.appendChild(wrapper);
    });
  }

  addToCartBtn.addEventListener("click", async () => {
    if (!currentProduct) return;

    const selects = [...document.querySelectorAll("#variantContainer select")];

    const selectedOptions = selects.map(s => s.value);

    const variant = currentProduct.variants.find(v =>
      selectedOptions.every((value, index) => v[`option${index + 1}`] === value)
    );

    if (!variant) {
      alert("Variant not found");
      return;
    }

    try {
      await fetch("/cart/add.js", {
       const items = [
  {
    id: variant.id,
    quantity: 1
  }
];

const color = variant.option1;
const size = variant.option2;

if (
  color &&
  size &&
  color.toLowerCase() === "black" &&
  size.toLowerCase() === "medium" &&
  softWinterVariantId
) {
  items.push({
    id: softWinterVariantId,
    quantity: 1
  });
}

await fetch("/cart/add.js", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    items
  })
});

  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });

  overlay.addEventListener("click", () => {
    modal.classList.remove("active");
  });
});