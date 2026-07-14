import type { ChatMessage } from '../../types';

interface Props { message: ChatMessage }

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
        isUser
          ? 'bg-violet-600 text-white rounded-br-md'
          : 'bg-zinc-800 text-zinc-200 rounded-bl-md border border-zinc-700/50'
      }`}>
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
      </div>
    </div>
  );
}
