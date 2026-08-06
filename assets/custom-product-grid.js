const modal = document.getElementById("productModal");

const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalPrice = document.getElementById("modalPrice");
const modalDescription = document.getElementById("modalDescription");
const variantContainer = document.getElementById("variantContainer");

document.querySelectorAll(".product-popup-btn").forEach(button=>{

button.addEventListener("click",async()=>{

const handle = button.dataset.handle;

const response = await fetch(`/products/${handle}.js`);

const product = await response.json();

modal.classList.add("active");

modalImage.src = product.featured_image;

modalTitle.textContent = product.title;

modalPrice.textContent =
Shopify.formatMoney(product.price);

modalDescription.innerHTML = product.description;

let html="";

product.options.forEach((option,index)=>{

html+=`
<label>${option}</label>

<select data-option="${index}">

${product.options_with_values[index].values
.map(value=>`<option>${value}</option>`)
.join("")}

</select>

`;

});

variantContainer.innerHTML=html;

});

});

document.querySelector(".modal-close").onclick=()=>{

modal.classList.remove("active");

}

document.querySelector(".modal-overlay").onclick=()=>{

modal.classList.remove("active");

}
document.querySelectorAll('.product-popup-btn').forEach(button => {
  button.addEventListener('click', () => {
    alert(button.dataset.handle);
  });
});