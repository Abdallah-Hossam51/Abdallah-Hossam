document.addEventListener("DOMContentLoaded", () => {

  const modal = document.getElementById("productModal");

if (!modal) {
  console.error("Modal not found");
  return;
}
  const modalImage = document.getElementById("modalImage");
  const modalTitle = document.getElementById("modalTitle");
  const modalPrice = document.getElementById("modalPrice");
  const modalDescription = document.getElementById("modalDescription");

  document.querySelectorAll(".product-popup-btn").forEach(button => {

    button.addEventListener("click", async () => {

      const handle = button.dataset.handle;

      const response = await fetch(`/products/${handle}.js`);
      const product = await response.json();

      modal.classList.add("active");

      modalImage.src = product.featured_image;

      modalTitle.textContent = product.title;

      modalPrice.textContent = `$${(product.price / 100).toFixed(2)}`;

      modalDescription.innerHTML = product.description;

    });

  });

  document.querySelector(".modal-close").onclick = () => {
    modal.classList.remove("active");
  };

  document.querySelector(".modal-overlay").onclick = () => {
    modal.classList.remove("active");
  };

});
