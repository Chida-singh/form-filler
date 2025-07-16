chrome.storage.local.get("formData", (res) => {
  const data = res.formData || {};
  const container = document.getElementById("data");

  for (const [label, value] of Object.entries(data)) {
    const div = document.createElement("div");
    div.textContent = `${label}: ${value}`;
    container.appendChild(div);
  }
});
