document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("productModal");

  if (!modal) return;
const SOFT_WINTER_JACKET_VARIANT = 47245054771388;
  const modalImage = document.getElementById("modalImage");
  const modalTitle = document.getElementById("modalTitle");
  const modalPrice = document.getElementById("modalPrice");
  const modalDescription = document.getElementById("modalDescription");
  const variantContainer = document.getElementById("variantContainer");

  const closeBtn = document.querySelector(".modal-close");
  const overlay = document.querySelector(".modal-overlay");

  let currentProduct = null;
  
  document.querySelectorAll(".product-popup-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      try {


    await fetch("/cart/add.js", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: variant.id,
            quantity: 1
        })
    });

 
    const color = variant.option1;
    const size = variant.option2;

    if (color === "Black" && size === "Medium") {

        await fetch("/cart/add.js", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: SOFT_WINTER_JACKET_VARIANT,
                quantity: 1
            })
        });

    }

    window.location.href = "/cart";

} catch (e) {
    console.error(e);
}
const color = variant.option1;
const size = variant.option2;

if (color === "Black" && size === "Medium") {

    await fetch("/cart/add.js",{

        method:"POST",

        headers:{
            "Content-Type":"application/json"
        },

        body:JSON.stringify({

            id:SOFT_WINTER_JACKET_VARIANT,

            quantity:1

        })

    });

}
            body: JSON.stringify({

                id: variant.id,

                quantity: 1

            })

        });

        window.location.href="/cart";

    }

    catch(e){

        console.error(e);

    }

});

});