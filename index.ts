import { PrismaClient } from '@prisma/client';
import express from 'express';
import path from 'path';

const app = express();
const prisma = new PrismaClient();

// EJSのテンプレートエンジンを設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views')); // 環境に合わせてパスは調整してください

// リクエストの解析設定
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- ロジック：優先順位の計算 ---
// 「期限までの残り時間」から「見積時間」を引いた猶予時間が短いほど、優先順位を高く（スコアを小さく）します
function calculatePriorityScore(task: any): number {
  const now = new Date().getTime();
  const deadline = new Date(task.deadline).getTime();
  
  // 期限までの残り時間（分）
  const remainingMinutes = (deadline - now) / (1000 * 60);
  
  // 猶予時間 = 残り時間 - 見積時間
  // この値が小さい（またはマイナス＝手遅れ）ほど、すぐにやるべきタスク
  return remainingMinutes - task.estimated_minutes;
}

// ページ表示（フロントエンドへの受け渡し）
app.get('/', async (req, res) => {
  res.render('index');
});

// 1. タスクの一覧を取得する (API)
app.get('/tasks', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany();
    
    // 優先順位スコアを計算して、昇順（猶予が少ない順）に並び替え
    const sortedTasks = tasks.map(task => ({
      ...task,
      priorityScore: calculatePriorityScore(task)
    })).sort((a, b) => a.priorityScore - b.priorityScore);

    res.json(sortedTasks);
  } catch (error) {
    res.status(500).json({ error: 'タスクの取得に失敗しました' });
  }
});

// 2. 新しいタスクを作る (API)
app.post('/tasks', async (req, res) => {
  const { title, deadline, estimated_minutes, parent_id } = req.body;
  try {
    const newTask = await prisma.task.create({
      data: {
        title,
        deadline: new Date(deadline),
        estimated_minutes: parseInt(estimated_minutes),
        status: 'pending',
        parent_id: parent_id ? parseInt(parent_id) : null
      }
    });
    res.json(newTask);
  } catch (error) {
    res.status(500).json({ error: 'タスクの作成に失敗しました' });
  }
});

// 3. タスクを更新する（完了にする） (API)
app.patch('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const updatedTask = await prisma.task.update({
      where: { id: parseInt(id) },
      data: { status: 'completed' }
    });
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: 'タスクの更新に失敗しました' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});