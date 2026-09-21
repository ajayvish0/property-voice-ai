// scoring.js
export function evaluateSession(messages) {
  const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
  const aiMsgs = messages.filter(m => m.role === 'assistant').map(m => m.content.toLowerCase());
  const feedback = [];

  // Persuasion (25)
  let persuasion = 0;
  if (userMsgs.some(m => /market|rate|comparable|average|research|similar|value|fair/.test(m))) {
    persuasion += 10; feedback.push({ type: 'success', text: 'Used market data to negotiate — strong persuasion.' });
  }
  if (userMsgs.some(m => /ready|cash|immediate|today|token|advance|now|quick|this week/.test(m))) {
    persuasion += 10; feedback.push({ type: 'success', text: 'Created urgency with buyer readiness.' });
  }
  if (userMsgs.some(m => /\b(7[0-9]|80)\s*(lakh|l|lac|lakhs)?\b/.test(m))) {
    persuasion += 5; feedback.push({ type: 'success', text: 'Made a specific price counter-offer.' });
  }
  if (persuasion === 0) feedback.push({ type: 'warn', text: 'No persuasion tactics used. Try citing market rates.' });

  // Clarity (20)
  const clearMsgs = userMsgs.filter(m => m.length >= 15 && m.length <= 400);
  const clarity = Math.min(clearMsgs.length * 4, 20);
  if (clarity >= 12) feedback.push({ type: 'success', text: 'Communicated clearly throughout the session.' });
  else if (clarity < 8) feedback.push({ type: 'warn', text: 'Responses were too brief. More detail builds trust.' });

  // Objection Handling (25)
  let objectionHandling = 0;
  const hadObjections = aiMsgs.some(m => /nahi|low|won't|not interested|wait|jaldi nahi|memories|saal/.test(m));
  if (hadObjections) {
    const handled = userMsgs.filter(m => /understand|appreciate|respect|i see|valid|absolutely|of course|point|sahi hai/.test(m)).length;
    objectionHandling = Math.min(handled * 9, 25);
    if (objectionHandling >= 18) feedback.push({ type: 'success', text: 'Handled seller objections with empathy and confidence.' });
    else if (objectionHandling > 0) feedback.push({ type: 'warn', text: 'Partially handled objections. Acknowledge before countering.' });
    else feedback.push({ type: 'error', text: 'Missed seller objections. Always address them directly.' });
  } else {
    objectionHandling = 12;
    feedback.push({ type: 'info', text: 'Conversation stayed constructive with few objections.' });
  }

  // Closing (30)
  let closing = 0;
  const closes = userMsgs.filter(m => /deal|finalize|agree|sign|advance|token|close|confirm|book|purchase|buy|ready to/.test(m)).length;
  if (closes >= 2) { closing = 30; feedback.push({ type: 'success', text: 'Multiple closing attempts — excellent deal instinct!' }); }
  else if (closes === 1) { closing = 20; feedback.push({ type: 'success', text: 'Made a closing attempt — try closing earlier next time.' }); }
  else feedback.push({ type: 'error', text: 'No closing attempt. Always try to seal the deal!' });

  // Engagement (10)
  let engagement = 0;
  if (userMsgs.length >= 8) { engagement = 10; feedback.push({ type: 'success', text: 'Excellent engagement — kept the conversation going.' }); }
  else if (userMsgs.length >= 5) engagement = 6;
  else if (userMsgs.length >= 3) engagement = 3;
  else feedback.push({ type: 'warn', text: 'Very short session. More exchanges = better outcomes.' });

  const breakdown = { persuasion, clarity, objectionHandling, closing, engagement };
  const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const maxScore = 110;

  let rating;
  if (totalScore >= 95) rating = 'Elite Negotiator 🏆';
  else if (totalScore >= 78) rating = 'Strong Performer 🌟';
  else if (totalScore >= 58) rating = 'Developing Agent 📈';
  else if (totalScore >= 38) rating = 'Needs Practice 💪';
  else rating = 'Keep Learning 📚';

  return { totalScore, maxScore, rating, breakdown, feedback, messageCount: userMsgs.length };
}
