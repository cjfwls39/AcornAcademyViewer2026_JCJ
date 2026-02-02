let pick = document.querySelector(".pick");
let word = document.querySelector(".word");
let moved = false;

window.addEventListener("scroll", function(){
    let value = this.window.scrollY;
    console.log("scrollY ", value);

    if(value > 750){
        pick.style.animation = 'unPick 1s ease-out forwards';
        moved = true;
    }else{
        pick.style.animation = 'pick 1s ease-out';
        moved = false;
    }
});