document.getElementById("dispatch-form")?.addEventListener("submit", function (e) {
  e.preventDefault();
  const subject = document.getElementById("f-subject").value;
  const reply = document.getElementById("f-reply").value;
  const message = document.getElementById("f-message").value;
  const body = message + "\n\nReply to: " + reply;
  const mailto = "mailto:correspondent@dispatchesfromthefarreaches.example"
    + "?subject=" + encodeURIComponent(subject)
    + "&body=" + encodeURIComponent(body);
  window.location.href = mailto;
});
