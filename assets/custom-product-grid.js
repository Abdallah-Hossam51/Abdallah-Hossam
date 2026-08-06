document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".product-popup-btn").forEach(button => {
    button.addEventListener("click", () => {
      alert("Clicked: " + button.dataset.handle);
    });
  });
});