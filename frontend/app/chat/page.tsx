"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, Send, User, Loader2, Database, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { chatService } from "@/lib/api/chat.service"
// AppSidebar is already rendered by ConditionalNavigation in the root layout

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sqlQuery?: string
  data?: Record<string, any>[]
  timestamp: Date
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hola! Soy tu asistente de IA para consultar documentos. Puedes preguntarme sobre tus documentos procesados, estadísticas, tipos de documentos, y más.",
      timestamp: new Date(),
    },
  ])
  const [inputMessage, setInputMessage] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return

    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: inputMessage,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const question = inputMessage
    setInputMessage("")
    setIsProcessing(true)

    try {
      const result = await chatService.query(question)

      const aiMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: result.answer,
        sqlQuery: result.query,
        data: result.data,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        "Error al procesar tu consulta"

      const aiMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: `⚠️ ${errorMsg}`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsProcessing(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClear = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Chat reiniciado. ¿En qué puedo ayudarte con tus documentos?",
        timestamp: new Date(),
      },
    ])
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-background">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Chat IA</h1>
              <p className="text-xs text-muted-foreground">
                Consulta inteligente sobre tus documentos
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
            Limpiar chat
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[80%] space-y-2 ${
                    message.role === "user" ? "items-end" : "items-start"
                  } flex flex-col`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.content}</p>
                  </div>

                  {/* SQL Query badge */}
                  {message.sqlQuery && (
                    <div className="w-full">
                      <details className="group">
                        <summary className="cursor-pointer flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <Database className="h-3 w-3" />
                          <span>Ver consulta SQL</span>
                        </summary>
                        <div className="mt-1 rounded-lg bg-muted/50 border border-border p-3">
                          <code className="text-xs font-mono text-muted-foreground break-all">
                            {message.sqlQuery}
                          </code>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Data table */}
                  {message.data && message.data.length > 0 && (
                    <Card className="w-full text-xs">
                      <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              {Object.keys(message.data[0]).map((key) => (
                                <th
                                  key={key}
                                  className="text-left px-3 py-2 font-semibold text-muted-foreground"
                                >
                                  {key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {message.data.map((row, idx) => (
                              <tr
                                key={idx}
                                className="border-b border-border/50 hover:bg-muted/20"
                              >
                                {Object.values(row).map((val, i) => (
                                  <td key={i} className="px-3 py-2">
                                    {String(val ?? "—")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}

                  <span className="text-[10px] text-muted-foreground">
                    {message.timestamp.toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Analizando...
                  </span>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-muted-foreground mb-2">
                Sugerencias:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "¿Cuántos documentos tengo?",
                  "¿Cuántos documentos están completados?",
                  "¿Qué tipos de documento hay?",
                  "¿Cuál es el documento más reciente?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputMessage(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border px-4 py-3 bg-background">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre tus documentos..."
              disabled={isProcessing}
              className="flex-1"
              autoFocus
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isProcessing}
              size="icon"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
  )
}
