// Debug script to check what the Gantt chart is receiving for Test Job 3
// Run this in browser console on the Gantt chart page

async function debugGanttData() {
  try {
    // Test the job we know has 8 status history entries
    const response = await fetch('/api/jobs/cc854915-d69e-4c94-84a6-a7c22a0bcb43/status-history');
    const data = await response.json();
    
    console.log('=== DEBUG GANTT DATA ===');
    console.log('Job ID:', data.job_id);
    console.log('Number of history entries:', data.history?.length || 0);
    console.log('Status history:', data.history);
    
    // Show each status change with dates
    if (data.history) {
      data.history.forEach((entry, index) => {
        console.log(`${index + 1}. Status: ${entry.status}, Date: ${entry.changed_at}, Notes: ${entry.notes}`);
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error debugging Gantt data:', error);
  }
}

// Run the debug
debugGanttData();