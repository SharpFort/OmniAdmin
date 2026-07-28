// 评论数据模型
export interface Comment {
  id: number
  author: string
  content: string
  timestamp: string
  replies: Comment[]
}

// 评论列表数据
import { ref } from 'vue'

export const commentList = ref<Comment[]>([
  {
    id: 1,
    author: '张三',
    content: '这个管理系统界面设计非常精美，功能也很完善！',
    timestamp: '2025-01-15T08:30:00.000Z',
    replies: [
      {
        id: 11,
        author: '李四',
        content: '同意，特别是主题切换功能很流畅。',
        timestamp: '2025-01-15T09:00:00.000Z',
        replies: []
      }
    ]
  },
  {
    id: 2,
    author: '王五',
    content: '希望能增加更多的图表组件。',
    timestamp: '2025-01-16T10:20:00.000Z',
    replies: []
  }
])
