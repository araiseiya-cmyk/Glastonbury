const { PrismaClient } = require('@prisma/client');
const express = require('express');
const path = require('path');

// 💡 安定版なので、これだけで完璧に sqlite (dev.db) に繋がります！
const prisma = new PrismaClient();

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// （これより下のロジックや API ルートは、今のままで一切変更しなくて大丈夫です！）

function calculatePriorityScore(task) {
  const now = new Date().getTime();
  const deadline = new Date(task.deadline).getTime();
  const remainingMinutes = (deadline - now) / (1000 * 60);
  return remainingMinutes - task.estimated_minutes;
}

app.get('/', async (req, res) => {
  res.render('index');
});

// 1. タスクの一覧を取得する
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany();
    const sortedTasks = tasks.map(task => ({
      ...task,
      priorityScore: calculatePriorityScore(task)
    })).sort((a, b) => a.priorityScore - b.priorityScore);
    res.json(sortedTasks);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ error: 'タスクの取得に失敗しました' });
  }
});

// 2. 新しいタスクを作る
app.post('/tasks', async (req, res) => {
  const { title, deadline, estimated_minutes, parent_id } = req.body;
  try {
    const newTask = await prisma.task.create({
      data: {
        title,
        deadline: new Date(deadline).toISOString(),
        estimated_minutes: parseInt(estimated_minutes),
        status: 'pending',
        parent_id: parent_id ? parseInt(parent_id) : null
      }
    });
    res.json(newTask);
  } catch (error) {
    console.error('Create Error:', error);
    res.status(500).json({ error: 'タスクの作成に失敗しました' });
  }
});

// 3. タスクを更新する
app.patch('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: { status: 'completed' }
    });
    res.json(updatedTask);
  } catch (error) {
    console.error('Update Error:', error);
    res.status(500).json({ error: 'タスクの更新に失敗しました' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});