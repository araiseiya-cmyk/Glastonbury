const { PrismaClient } = require('@prisma/client');
const express = require('express');
const path = require('path');

const prisma = new PrismaClient();
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, './views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function calculatePriorityScore(task) {
  const now = new Date().getTime();
  const deadline = new Date(task.deadline).getTime();
  const remainingMinutes = (deadline - now) / (1000 * 60);
  return remainingMinutes - task.estimated_minutes;
}

// 💡 【重要】定期タスクを自動生成する関数
async function generateRecurringTasks() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // 1. 登録されている「定期タスクのマスターデータ」を取得
  const recurringTemplates = await prisma.task.findMany({
    where: { is_recurring: true }
  });

  for (const template of recurringTemplates) {
    let shouldCreate = false;
    let taskDeadline = new Date();

    if (template.recurrence_type === 'daily') {
      // 毎日の場合：今日その時間のタスクを生成する
      shouldCreate = true;
      if (template.recurrence_time) {
        const [hour, minute] = template.recurrence_time.split(':');
        taskDeadline.setHours(parseInt(hour), parseInt(minute), 0, 0);
      }
    } else if (template.recurrence_type === 'weekly') {
      // 毎週の場合：今日が指定された曜日（例：毎週月曜）なら生成する
      const currentDay = now.getDay(); // 0(日)〜6(土)
      if (currentDay === template.recurrence_day) {
        shouldCreate = true;
        if (template.recurrence_time) {
          const [hour, minute] = template.recurrence_time.split(':');
          taskDeadline.setHours(parseInt(hour), parseInt(minute), 0, 0);
        }
      }
    }

    if (shouldCreate) {
      // 今日すでに同じ定期テンプレートからタスク（status='pending'または'completed'）が作られていないか重複チェック
      const existingTask = await prisma.task.findFirst({
        where: {
          title: template.title,
          deadline: {
            gte: todayStart,
            lte: todayEnd
          },
          is_recurring: false // 生成された実タスクは単発扱いにする
        }
      });

      // まだ作られていなければ、今日のタスクとして実体を新規自動作成！
      if (!existingTask) {
        await prisma.task.create({
          data: {
            title: template.title,
            deadline: taskDeadline,
            estimated_minutes: template.estimated_minutes,
            status: 'pending',
            parent_id: template.parent_id,
            is_recurring: false // 実タスクは繰り返さないようにfalseにする
          }
        });
        console.log(`[自動生成] 定期タスク「${template.title}」を作成しました。`);
      }
    }
  }
}

app.get('/', async (req, res) => {
  res.render('index');
});

// 1. タスクの一覧を取得する
app.get('/tasks', async (req, res) => {
  try {
    // タスク一覧を取得する前に、定期タスクの自動生成処理を走らせる！
    await generateRecurringTasks();

    // 画面に表示するのは「定期テンプレートそのもの（is_recurring: true）」ではなく、
    // 生成された「実タスク（is_recurring: false）」だけに絞る
    const tasks = await prisma.task.findMany({
      where: { is_recurring: false }
    });

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
  const { title, deadline, estimated_minutes, parent_id, is_recurring, recurrence_type, recurrence_day, recurrence_time } = req.body;
  try {
    const newTask = await prisma.task.create({
      data: {
        title,
        // 定期タスクテンプレートの場合は期限を仮で現在にしておく
        deadline: deadline ? new Date(deadline).toISOString() : new Date().toISOString(),
        estimated_minutes: parseInt(estimated_minutes),
        status: is_recurring ? 'template' : 'pending', // テンプレートは区別する
        parent_id: parent_id ? parseInt(parent_id) : null,
        is_recurring: !!is_recurring,
        recurrence_type: recurrence_type || null,
        recurrence_day: recurrence_day ? parseInt(recurrence_day) : null,
        recurrence_time: recurrence_time || null
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