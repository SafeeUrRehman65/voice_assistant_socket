export const typeGreeting = (text, ref, timerRefChar, timerRefWord) => {
  const words = text.split(" ");
  let currentwordIndex = 0;
  const greeting_length = words.length - 1;

  if (timerRefWord.current) {
    clearTimeout(timerRefWord.current);
  }
  const typeWords = () => {
    if (timerRefChar.current) {
      clearTimeout(timerRefChar.current);
    }
    if (currentwordIndex <= greeting_length) {
      const word = words[currentwordIndex];
      // console.log("word", word);
      const word_length = words[currentwordIndex].length;
      // console.log("word_length", word_length);
      let currentcharIndex = 0;
      const typeChar = () => {
        if (currentcharIndex < word_length) {
          const current_char = word[currentcharIndex];
          // console.log("current_char", current_char);
          // fade-in effect
          const span = document.createElement("span");
          span.innerText = current_char;
          span.style.opacity = 0;
          span.style.transition = "opacity 0.15s";
          ref.current.appendChild(span);
          setTimeout(() => (span.style.opacity = 1), 10);

          currentcharIndex++;
          const delay = 30 + Math.random() * 30;
          timerRefChar.current = setTimeout(typeChar, delay);
        } else {
          currentwordIndex += 1;
          if (currentwordIndex <= greeting_length) {
            const span = document.createElement("span");
            span.innerText = " ";
            span.style.opacity = 0;
            span.style.transition = "opacity 0.15s";
            ref.current.appendChild(span);
            setTimeout(() => (span.style.opacity = 1), 10);
          }
          // technique for typing smaller words faster and longer words slower
          timerRefWord.current = setTimeout(
            typeWords,
            word_length <= 5 ? 50 + Math.random() * 50 : 70 + Math.random() * 70
          );
        }
      };
      typeChar();
    }
  };

  ref.current.innerText = "";
  typeWords();
};
