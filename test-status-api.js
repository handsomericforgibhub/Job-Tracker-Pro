// Quick test to verify the status history API returns real data
// Run this in your browser console on any page of your app

async function testStatusHistoryAPI() {
  try {
    const response = await fetch('/api/jobs/cc854915-d69e-4c94-84a6-a7c22a0bcb43/status-history');
    const data = await response.json();
    console.log('Status history API response:', data);
    console.log('Number of history entries:', data.history?.length || 0);
    console.log('History entries:', data.history);
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Run the test
testStatusHistoryAPI();