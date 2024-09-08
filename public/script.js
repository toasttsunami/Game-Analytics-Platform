// Get player analytics
function getPlayerAnalytics(playerId) {
  fetch(`/analytics/${playerId}`)
      .then(response => response.json())
      .then(data => {
          document.getElementById('analytics-result').innerText = JSON.stringify(data);
      });
}

// Get game recommendations
function getRecommendations(playerId) {
  fetch(`/recommendations/${playerId}`)
      .then(response => response.json())
      .then(data => {
          document.getElementById('recommendations-result').innerText = JSON.stringify(data);
      });
}

// Submit a review
function submitReview() {
  const reviewText = document.getElementById('review-text').value;

  fetch('/reviews/analyze-review', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          gameId: 'game123',
          playerId: 'player123',
          review: reviewText,
      }),
  })
      .then(response => response.json())
      .then(data => {
          document.getElementById('review-result').innerText = 'Sentiment Score: ' + data.sentiment;
      });
}
