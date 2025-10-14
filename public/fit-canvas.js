function fitCanvasToContainer() {
    const canvas = document.getElementById("unity-canvas");
    const parent = canvas.parentElement;
    if (!canvas || !parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    canvas.style.width = parent.clientWidth + "px";
    canvas.style.height = parent.clientHeight + "px";
}

window.addEventListener("load", fitCanvasToContainer);
window.addEventListener("resize", fitCanvasToContainer);