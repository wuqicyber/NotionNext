import { useState, useEffect, useRef } from 'react'
import BLOG from '@/blog.config'
import { useGlobal } from '@/lib/global'
import { useRouter } from 'next/router'

const ReadwiseModal = () => {
  const router = useRouter()
  const modalRef = useRef(null)

  // 是否挂载
  const [mounted, setMounted] = useState(false)

  // 所有获取到的高亮列表
  const [highlights, setHighlights] = useState([])
  // 当前展示第几个
  const [currentIndex, setCurrentIndex] = useState(0)

  // 控制是否可见
  const [isVisible, setIsVisible] = useState(true)
  // 接口加载状态
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 拖拽位置
  const [position, setPosition] = useState({ x: 0, y: 0 })
  // 是否正在拖拽
  const [isDragging, setIsDragging] = useState(false)
  // 拖拽初始差值
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  // 存一下当前的动画帧 id 用于取消
  const dragAnimationFrameRef = useRef(null)

  // ==========================
  // 1. 路由变化时，自动关闭悬浮窗
  // ==========================
  useEffect(() => {
    const handleRouteChange = () => {
      setIsVisible(false)
    }
    router.events.on('routeChangeStart', handleRouteChange)
    return () => {
      router.events.off('routeChangeStart', handleRouteChange)
    }
  }, [router])

  // ==========================
  // 2. 第一次挂载后，获取所有高亮
  // ==========================
  useEffect(() => {
    setMounted(true)

    console.log(
      '%c ReadwiseModal useEffect 触发',
      'color: #ff6b6b; font-size: 1.2em;'
    )

    // 如果启用了 READWISE，则去拉取数据
    if (BLOG.READWISE_ENABLED) {
      fetchAllHighlights()
    }
  }, [])

  // 一次性拉取所有数据
  const fetchAllHighlights = async () => {
    if (!BLOG.READWISE_API_KEY) {
      setError('未配置 Readwise API Key')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log('开始获取 Readwise 数据...')

      const response = await fetch('https://readwise.io/api/v2/review/', {
        method: 'GET',
        headers: {
          Authorization: `Token ${BLOG.READWISE_API_KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        credentials: 'omit'
      })

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`预期接收 JSON 数据，但收到 ${contentType}`)
      }

      const data = await response.json()
      console.log('获取到的数据:', data)

      if (data.highlights && data.highlights.length > 0) {
        setHighlights(data.highlights)
        setCurrentIndex(0) // 默认先展示第一条（或随机）
      } else {
        setError('没有找到任何高亮内容')
      }
    } catch (err) {
      console.error('获取 Readwise 数据失败:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ==========================
  // 3. 切换下一条高亮
  // ==========================
  const refreshHighlight = () => {
    if (!highlights || highlights.length === 0) {
      return
    }
    // 这里可以随机 or 顺序
    // （1）顺序：
    // setCurrentIndex((prev) => (prev + 1) % highlights.length)

    // （2）随机：
    const randomIndex = Math.floor(Math.random() * highlights.length)
    setCurrentIndex(randomIndex)
  }

  // 当前展示的那一条
  const highlight = highlights[currentIndex] || null

  // ==========================
  // 4. 拖拽相关逻辑（Pointer Events + RAF）
  // ==========================
  const handlePointerDown = (e) => {
    // 仅使用左键
    if (e.pointerType === 'mouse' && e.button !== 0) return

    setIsDragging(true)
    // 记录鼠标/手指在元素内的偏移量
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return

    // 若已有动画帧，则先取消
    if (dragAnimationFrameRef.current) {
      cancelAnimationFrame(dragAnimationFrameRef.current)
    }
    // 利用 requestAnimationFrame 来节流
    dragAnimationFrameRef.current = requestAnimationFrame(() => {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      setPosition({ x: newX, y: newY })
    })
  }

  const handlePointerUp = (e) => {
    setIsDragging(false)
  }

  // 绑定/解绑全局事件
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    } else {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current)
      }
    }
    // cleanup
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      if (dragAnimationFrameRef.current) {
        cancelAnimationFrame(dragAnimationFrameRef.current)
      }
    }
  }, [isDragging, dragOffset])

  // 在服务器端或未挂载时不渲染任何内容
  if (!mounted || !BLOG.READWISE_ENABLED || !isVisible) {
    return null
  }

  return (
    <div
      ref={modalRef}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className="fixed top-1/3 left-4 max-w-md w-full md:w-96 bg-white dark:bg-gray-800 
                 rounded-lg shadow-xl z-50 transition-all duration-300 
                 border border-gray-200 dark:border-gray-700 hover:shadow-2xl"
      onPointerDown={handlePointerDown}
    >
      <div className="relative p-6">
        {/* 关闭按钮 */}
        <button
          onClick={() => setIsVisible(false)}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 
                     dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
            <svg
              className="w-6 h-6 mr-2 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 
                   7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 
                   5.754 18 7.5 18s3.332.477 4.5 1.253m0-13
                   C13.168 5.477 14.754 5 16.5 5c1.747 0 
                   3.332.477 4.5 1.253v13C19.832 18.477 
                   18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            ReadWise Daily Review
          </h3>
        </div>

        {/* 加载中 */}
        {loading && (
          <div className="flex justify-center items-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 p-3 rounded">
            {error}
          </div>
        )}

        {/* 展示当前的高亮 */}
        {!loading && !error && highlight && (
          <blockquote className="text-gray-800 dark:text-gray-200 
                                bg-gray-50 dark:bg-gray-700/50 
                                p-4 rounded-lg">
            <p className="text-base italic leading-relaxed">"{highlight.text}"</p>
            <footer className="mt-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                — {highlight.title || '未知标题'}
                {highlight.author && ` by ${highlight.author}`}
              </p>
            </footer>
          </blockquote>
        )}

        {/* 底部按钮：换一条 or 跳转 */}
        <div className="mt-6 flex justify-between items-center text-sm">
          <button
            onClick={refreshHighlight}
            className="text-indigo-600 dark:text-indigo-400 
                       hover:text-indigo-700 dark:hover:text-indigo-300 
                       font-medium"
          >
            换一条回顾 ↻
          </button>
          <a
            href="https://readwise.io/dailyreview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 
                       dark:text-gray-400 dark:hover:text-gray-300"
          >
            前往 Readwise
          </a>
        </div>
      </div>
    </div>
  )
}

export default ReadwiseModal