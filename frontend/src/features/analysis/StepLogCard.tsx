import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button, Collapse, Space } from 'antd'
import type { AnalysisStep, StepStatus } from '../../types/analysis'

interface Props {
  step: AnalysisStep
  onRetry?: (stepId: string) => void
  animate?: boolean
}

function getIcon(status: StepStatus) {
  switch (status) {
    case 'WAITING':
      return <ClockCircleOutlined style={{ color: '#999' }} />
    case 'RUNNING':
      return <LoadingOutlined style={{ color: '#1677ff' }} />
    case 'SUCCEEDED':
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'FAILED':
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
  }
}

export function StepLogCard({ step, onRetry, animate = true }: Props) {
  const targetContent = step.content || ''
  const [displayedContent, setDisplayedContent] = useState(
    animate ? '' : targetContent,
  )
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (!animate) {
      setDisplayedContent(targetContent)
      return
    }

    setDisplayedContent((current) => {
      if (!targetContent.startsWith(current)) return ''
      return current
    })

    timerRef.current = setInterval(() => {
      setDisplayedContent((current) => {
        if (current.length >= targetContent.length) {
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          return current
        }
        return targetContent.slice(0, current.length + 1)
      })
    }, 20)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [targetContent, animate])

  const isTyping = animate && displayedContent.length < targetContent.length
  const cursorStyle: CSSProperties = {
    display: 'inline-block',
    width: 2,
    height: '1em',
    backgroundColor: '#1677ff',
    marginLeft: 1,
    verticalAlign: 'text-bottom',
    animation: 'typewriter-blink 0.8s steps(1) infinite',
  }

  return (
    <>
      <style>{`
        @keyframes typewriter-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      <Collapse
        items={[
          {
            key: step.id,
            label: (
              <Space>
                {getIcon(step.status)}
                <span>
                  {step.displayName}
                  {step.summary ? ` - ${step.summary}` : ''}
                </span>
                {step.status === 'FAILED' && onRetry && (
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<ReloadOutlined />}
                    onClick={(event) => {
                      event.stopPropagation()
                      onRetry(step.id)
                    }}
                  >
                    重试
                  </Button>
                )}
              </Space>
            ),
            children: (
              <p>
                {displayedContent}
                {isTyping && <span style={cursorStyle} />}
              </p>
            ),
          },
        ]}
      />
    </>
  )
}
