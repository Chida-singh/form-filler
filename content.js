chrome.storage.local.get("formData", (res) => {
  const savedData = res.formData || {};
  const inputs = document.querySelectorAll("input, textarea");

  inputs.forEach((input) => {
    const parent = input.closest("div");
    if (!parent) return;

    const label = parent.innerText.trim();
    if (!label) return;

    if (savedData[label]) {
      input.value = savedData[label];
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      const userVal = prompt(`Enter value for "${label}"`);
      if (userVal !== null) {
        input.value = userVal;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        savedData[label] = userVal;
        chrome.storage.local.set({ formData: savedData });
      }
    }
  });
});
