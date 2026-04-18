const tasks = [
  { id: 'b93', name: 'Classification', status: 'waiting', createdAt: 1776284188858 },
  { id: 'cf2', name: 'Crawling', status: 'waiting', createdAt: 1776284358321 },
  { id: '4d6', name: 'Outreaching', status: 'in_progress', createdAt: 1776284544439 }
];
const currentTaskId = '4d6';
const startOfToday = 0;

const currentTask = tasks.find(t => t.id === currentTaskId || t.status === "in_progress");
const inReviewTasks = tasks.filter(t => t.status === "in_review" && t.id !== currentTask?.id);
const upNextTasks = tasks.filter(t => t.status === "up_next" && t.id !== currentTask?.id);
const doneTasks = tasks.filter(t => t.status === "done" && t.id !== currentTask?.id);
const waitingTasks = tasks.filter(t => t.status === "waiting" && t.id !== currentTask?.id);

const displayTasks = [];
displayTasks.push(...upNextTasks);
if (currentTask) displayTasks.push(currentTask);
displayTasks.push(...inReviewTasks);
displayTasks.push(...doneTasks);
displayTasks.push(...waitingTasks);

console.log(displayTasks.length);
console.log(displayTasks);
