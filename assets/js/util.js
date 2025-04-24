function copyToClipboard() {
    const textarea = document.getElementById("output");
    textarea.select();
    document.execCommand("copy");
  
    const popup = document.getElementById("popupMessage");
    popup.style.display = "block";
  
    setTimeout(() => {
      popup.style.display = "none";
    }, 3000);
  }