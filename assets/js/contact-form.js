const form = document.getElementById("dispatch-form");
const note = document.getElementById("dispatch-form-note");

form?.addEventListener("submit", async function (e) {
  e.preventDefault();
  const submitBtn = form.querySelector(".submit-btn");
  submitBtn.disabled = true;
  note.textContent = "Filing the dispatch…";

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form),
    });
    const result = await response.json();

    if (result.success) {
      form.reset();
      let secondsLeft = 5;
      const tick = () => {
        note.innerHTML = `Dispatch received. A reply will follow. Returning you to the main page in <strong class="countdown-num">${secondsLeft}</strong>…`;
      };
      tick();
      const countdown = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          clearInterval(countdown);
          window.location.href = "/";
        } else {
          tick();
        }
      }, 1000);
    } else {
      note.textContent = "Something went wrong filing that. Please try again.";
    }
  } catch (err) {
    note.textContent = "Something went wrong filing that. Please try again.";
  } finally {
    submitBtn.disabled = false;
  }
});
