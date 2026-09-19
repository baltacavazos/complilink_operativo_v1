import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  WORKER_CHAT_NEXT_HEADING,
  parseWorkerStructuredAnswer,
  sanitizeVisibleChatHistoryContent,
} from "@shared/workerChatUx";
import { Loader2, Send, User, Sparkles } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Streamdown } from "streamdown";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  /**
   * Messages array to display in the chat.
   * Should match the format used by invokeLLM on the server.
   */
  messages: Message[];

  /**
   * Callback when user sends a message.
   * Typically you'll call a tRPC mutation here to invoke the LLM.
   */
  onSendMessage: (content: string) => void;

  /**
   * Whether the AI is currently generating a response
   */
  isLoading?: boolean;

  /**
   * Placeholder text for the input field
   */
  placeholder?: string;

  /**
   * Custom className for the container
   */
  className?: string;

  /**
   * Height of the chat box (default: 600px)
   */
  height?: string | number;

  /**
   * Empty state message to display when no messages
   */
  emptyStateMessage?: string;

  /**
   * Suggested prompts to display in empty state
   * Click to send directly
   */
  suggestedPrompts?: string[];

  /**
   * Visual surface. `calm` is the Apple-quiet worker chat.
   */
  variant?: "default" | "calm";
};

/**
 * A ready-to-use AI chat box component that integrates with the LLM system.
 *
 * Features:
 * - Matches server-side Message interface for seamless integration
 * - Markdown rendering with Streamdown
 * - Auto-scrolls to latest message
 * - Loading states
 * - Uses global theme colors from index.css
 *
 * @example
 * ```tsx
 * const ChatPage = () => {
 *   const [messages, setMessages] = useState<Message[]>([
 *     { role: "system", content: "You are a helpful assistant." }
 *   ]);
 *
 *   const chatMutation = trpc.ai.chat.useMutation({
 *     onSuccess: (response) => {
 *       // Assuming your tRPC endpoint returns the AI response as a string
 *       setMessages(prev => [...prev, {
 *         role: "assistant",
 *         content: response
 *       }]);
 *     },
 *     onError: (error) => {
 *       console.error("Chat error:", error);
 *       // Optionally show error message to user
 *     }
 *   });
 *
 *   const handleSend = (content: string) => {
 *     const newMessages = [...messages, { role: "user", content }];
 *     setMessages(newMessages);
 *     chatMutation.mutate({ messages: newMessages });
 *   };
 *
 *   return (
 *     <AIChatBox
 *       messages={messages}
 *       onSendMessage={handleSend}
 *       isLoading={chatMutation.isPending}
 *       suggestedPrompts={[
 *         "Explain quantum computing",
 *         "Write a hello world in Python"
 *       ]}
 *     />
 *   );
 * };
 * ```
 */
function CalmAssistantAnswer({ content }: { content: string }) {
  const blocks = parseWorkerStructuredAnswer(sanitizeVisibleChatHistoryContent(content));
  if (blocks.length === 0) {
    return null;
  }

  if (blocks.length === 1 && blocks[0]?.kind === "plain") {
    return (
      <p className="whitespace-pre-wrap text-[0.95rem] leading-[1.55] tracking-[-0.018em]">
        {blocks[0].body}
      </p>
    );
  }

  return (
    <div className="ap-chat-answer space-y-3">
      {blocks.map((block, index) => (
        <div
          key={`${block.kind}-${block.heading ?? "body"}-${index}`}
          className={cn(
            block.kind === "disclaimer"
              ? "ap-chat-disclaimer"
              : block.kind === "section"
                ? cn(
                    "ap-chat-section",
                    block.heading === WORKER_CHAT_NEXT_HEADING && "ap-chat-section-next",
                  )
                : null,
          )}
          data-testid={
            block.heading === WORKER_CHAT_NEXT_HEADING ? "ap-chat-next-step" : undefined
          }
        >
          {block.heading ? (
            <p className="ap-chat-section-label">{block.heading}</p>
          ) : null}
          <p
            className={cn(
              "whitespace-pre-wrap",
              block.kind === "disclaimer"
                ? "text-[0.78rem] leading-5 tracking-[-0.01em] text-slate-500"
                : "text-[0.95rem] leading-[1.55] tracking-[-0.018em]",
            )}
          >
            {block.body}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
  variant = "default",
}: AIChatBoxProps) {
  const isCalm = variant === "calm";
  const [input, setInput] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter out system messages and strip leftover plan markers from old history
  const displayMessages = messages
    .filter((msg) => msg.role !== "system")
    .map((msg) => ({
      ...msg,
      content: sanitizeVisibleChatHistoryContent(msg.content),
    }))
    .filter((msg) => msg.content.trim().length > 0);

  // Calculate min-height for last assistant message to push user message to top
  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;

      // Reserve space for:
      // - padding (p-4 = 32px top+bottom)
      // - user message: 40px (item height) + 16px (margin-top from space-y-4) = 56px
      // Note: margin-bottom is not counted because it naturally pushes the assistant message down
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;

      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  // Scroll to bottom helper function with smooth animation
  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    onSendMessage(trimmedInput);
    setInput("");

    // Scroll immediately after sending
    scrollToBottom();

    // Keep focus on input
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col",
        isCalm
          ? "bg-transparent text-slate-950 rounded-none border-0 shadow-none"
          : "bg-card text-card-foreground rounded-lg border shadow-sm",
        className
      )}
      data-ap-chat-box={isCalm ? "calm" : "default"}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <Sparkles className={cn("opacity-20", isCalm ? "size-8 text-teal-700" : "size-12")} />
                <p className={cn(isCalm ? "max-w-[22rem] text-center text-[0.95rem] leading-6 text-slate-500" : "text-sm")}>
                  {emptyStateMessage}
                </p>
              </div>

              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className={cn("flex flex-col", isCalm ? "space-y-5 px-1 py-3" : "space-y-4 p-4")}>
              {displayMessages.map((message, index) => {
                // Apply min-height to last message only if NOT loading (when loading, the loading indicator gets it)
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight =
                  !isCalm &&
                  isLastMessage &&
                  !isLoading &&
                  minHeightForLastMessage > 0;

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div
                        className={cn(
                          "shrink-0 mt-1 rounded-full flex items-center justify-center",
                          isCalm
                            ? "size-7 bg-teal-50 text-teal-700"
                            : "size-8 bg-primary/10",
                        )}
                      >
                        <Sparkles className={cn(isCalm ? "size-3.5" : "size-4 text-primary")} strokeWidth={1.7} />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%]",
                        isCalm
                          ? cn(
                              "ap-chat-bubble px-4 py-3",
                              message.role === "user"
                                ? "ap-chat-bubble-user"
                                : "ap-chat-bubble-assistant",
                            )
                          : cn(
                              "rounded-lg px-4 py-2.5",
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-foreground",
                            ),
                      )}
                    >
                      {message.role === "assistant" && !isCalm ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <Streamdown>{message.content}</Streamdown>
                        </div>
                      ) : message.role === "assistant" && isCalm ? (
                        <CalmAssistantAnswer content={message.content} />
                      ) : (
                        <p className={cn("whitespace-pre-wrap", isCalm ? "text-[0.95rem] leading-[1.55] tracking-[-0.018em]" : "text-sm")}>
                          {message.content}
                        </p>
                      )}
                    </div>

                    {message.role === "user" && !isCalm ? (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    !isCalm && minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div
                    className={cn(
                      "shrink-0 mt-1 rounded-full flex items-center justify-center",
                      isCalm ? "size-7 bg-teal-50 text-teal-700" : "size-8 bg-primary/10",
                    )}
                  >
                    <Sparkles className={cn(isCalm ? "size-3.5" : "size-4 text-primary")} strokeWidth={1.7} />
                  </div>
                  <div
                    className={cn(
                      isCalm
                        ? "ap-chat-bubble ap-chat-bubble-assistant px-4 py-3"
                        : "rounded-lg bg-muted px-4 py-2.5",
                    )}
                    aria-label={isCalm ? "Escribiendo" : undefined}
                  >
                    {isCalm ? (
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="ap-chat-dot" />
                        <span className="ap-chat-dot" />
                        <span className="ap-chat-dot" />
                      </div>
                    ) : (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className={cn(
          "flex items-end",
          isCalm ? "gap-0 p-1 pt-2" : "gap-2 p-4 border-t bg-background/50",
        )}
      >
        <div
          className={cn(
            "flex w-full items-end gap-2",
            isCalm && "ap-chat-composer px-2.5 py-1",
          )}
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "flex-1 max-h-32 resize-none",
              isCalm
                ? "min-h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
                : "min-h-9",
            )}
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            aria-label={isCalm ? "Enviar" : undefined}
            className={cn(
              "shrink-0",
              isCalm
                ? "h-10 w-10 rounded-full bg-teal-600 text-white shadow-none hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400"
                : "h-[38px] w-[38px]",
            )}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" strokeWidth={1.8} />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
