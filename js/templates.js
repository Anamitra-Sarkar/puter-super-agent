/* Templates gallery: one-click starters for normal people. No AI call until Send. */
(function () {
  const TPL = [
    { icon: "✈️", name: "Trip planner", prompt: "Plan a 4-day budget trip to [destination] for 2 people: day-wise itinerary, stays, food, transport and total cost estimate." },
    { icon: "📄", name: "Resume fixer", prompt: "Improve my resume below for clarity and impact. Rewrite bullets with strong verbs and numbers. Resume:\n\n[paste resume]" },
    { icon: "📧", name: "Email writer", prompt: "Write a polite professional email about: [topic]. Tone: friendly but formal. Include subject line." },
    { icon: "📚", name: "Homework helper", prompt: "Explain this topic step by step with a simple example, then give me 3 practice questions: [topic]" },
    { icon: "🥗", name: "Diet chart", prompt: "Make a 7-day vegetarian diet chart for weight loss (~1800 kcal/day) with Indian food options and a shopping list." },
    { icon: "📝", name: "Complaint letter", prompt: "Draft a firm but polite complaint letter to [company] about [issue]. Include order ID placeholder and expected resolution." },
    { icon: "💡", name: "Explain simply", prompt: "Explain [topic] like I'm 12, with an everyday analogy, then one level deeper." },
    { icon: "🧾", name: "Bill splitter", prompt: "Split this bill fairly and show who pays whom: [paste items]" },
    { icon: "🎤", name: "Speech writer", prompt: "Write a 2-minute speech for [occasion: birthday/farewell/wedding] for [person]. Warm, funny, short." },
    { icon: "🏋️", name: "Workout plan", prompt: "4-week beginner home workout plan, no equipment, 30 min/day. Include rest days and progression." },
    { icon: "📊", name: "Meeting notes", prompt: "Turn these rough notes into clean meeting minutes with decisions and action items:\n\n[paste notes]" },
    { icon: "🌐", name: "Translate", prompt: "Translate the following into [language], keeping tone and formatting:\n\n[paste text]" },
  ];
  function open() {
    const A = window.PuterAgent;
    const body = A.addMsg("assistant", "<b>📚 Templates — pick one, edit, Send</b><div class=\"tpl-grid\"></div>", "[templates]");
    const grid = body.querySelector(".tpl-grid");
    for (const t of TPL) {
      const b = document.createElement("button");
      b.className = "tpl-card";
      b.innerHTML = `<span class="tpl-ic">${t.icon}</span><b>${t.name}</b>`;
      b.onclick = () => {
        const inp = document.getElementById("userInput");
        inp.value = t.prompt;
        inp.focus();
        if (window.PuterUI) window.PuterUI.toast("Template loaded — fill the [blanks] and Send", "info");
      };
      grid.appendChild(b);
    }
  }
  window.PuterTemplates = { open, list: TPL };
})();
