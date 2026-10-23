import React from 'react';
import { History, UserRound } from 'lucide-react';

function formatActivityTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function TaskActivity({ entries = [], limit = 5 }) {
  const recentEntries = entries.slice(-limit).reverse();
  if (!recentEntries.length) return null;

  return (
    <section className="task-activity" aria-label="Task activity history">
      <h4><History size={15} /> Recent activity</h4>
      <ol>
        {recentEntries.map(entry => {
          const actor = entry.actor;
          const actorName = [actor?.firstName, actor?.lastName]
            .filter(Boolean)
            .join(' ') || 'Team member';

          return (
            <li key={entry._id || `${entry.action}-${entry.createdAt}`}>
              <span className="task-activity-avatar" aria-hidden="true">
                <UserRound size={14} />
              </span>
              <div className="task-activity-copy">
                <p><strong>{actorName}</strong> {entry.details}</p>
                <time dateTime={entry.createdAt}>
                  {formatActivityTime(entry.createdAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default TaskActivity;
