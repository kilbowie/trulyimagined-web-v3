'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft,
  Send,
  Clock,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Smile,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Calendar,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiClickData {
  emoji: string;
  [key: string]: unknown;
}

interface Message {
  id: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
  user_id: string;
  user_email: string;
  user_username: string | null;
}

interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed' | 'scheduled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  user_email: string;
  user_username: string | null;
  assigned_to_username: string | null;
  messages: Message[];
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  useEffect(() => {
    // Close emoji picker when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        showEmojiPicker &&
        !target.closest('.emoji-picker-container') &&
        !target.closest('[data-emoji-button]')
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/support/tickets/${ticketId}`);
      const data = await response.json();

      if (data.success) {
        setTicket(data.ticket);
        setIsAdmin(data.isAdmin || false);
        setCurrentUserId(data.currentUserId || null);
      } else {
        setError(data.error || 'Failed to load ticket');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('[FETCH_TICKET_ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const before = newMessage.substring(0, startPos);
    const after = newMessage.substring(endPos);
    const newValue = before + emojiData.emoji + after;

    setNewMessage(newValue);
    setShowEmojiPicker(false);

    // Set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = startPos + emojiData.emoji.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextFormat = (format: string, wrapper?: string, isPrefix?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const selectedText = newMessage.substring(startPos, endPos);
    const before = newMessage.substring(0, startPos);
    const after = newMessage.substring(endPos);

    let newValue = '';
    let newCursorPos = startPos;

    if (isPrefix) {
      // For prefix formats like bullets, quotes
      newValue = before + format + selectedText + after;
      newCursorPos = startPos + format.length + selectedText.length;
    } else if (wrapper) {
      // For link format
      newValue = before + format + selectedText + wrapper + after;
      newCursorPos = startPos + format.length + selectedText.length;
    } else {
      // For wrapping formats like bold, italic
      newValue = before + format + selectedText + format + after;
      newCursorPos = startPos + format.length + selectedText.length;
    }

    setNewMessage(newValue);

    // Set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      setError(null);

      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage,
          is_internal_note: isInternalNote,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setNewMessage('');
        setIsInternalNote(false);
        fetchTicket(); // Refresh to show new message
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
      console.error('[SEND_MESSAGE_ERROR]', err);
    } finally {
      setSending(false);
    }
  };

  const updateTicketStatus = async (status: string) => {
    try {
      setUpdating(true);
      setError(null);

      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (data.success) {
        fetchTicket(); // Refresh ticket
      } else {
        setError(data.error || 'Failed to update ticket');
      }
    } catch (err) {
      setError('Failed to update ticket');
      console.error('[UPDATE_TICKET_ERROR]', err);
    } finally {
      setUpdating(false);
    }
  };

  const updateTicketPriority = async (priority: string) => {
    try {
      setUpdating(true);
      setError(null);

      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });

      const data = await response.json();

      if (data.success) {
        fetchTicket();
      } else {
        setError(data.error || 'Failed to update priority');
      }
    } catch (err) {
      setError('Failed to update priority');
      console.error('[UPDATE_PRIORITY_ERROR]', err);
    } finally {
      setUpdating(false);
    }
  };

  const getStatusIcon = (status: Ticket['status']) => {
    const icons = {
      open: AlertCircle,
      in_progress: Clock,
      waiting_on_user: Clock,
      scheduled: Calendar,
      resolved: CheckCircle2,
      closed: XCircle,
    };
    return icons[status];
  };

  const getStatusColor = (status: Ticket['status']) => {
    const colors = {
      open: 'text-blue-500',
      in_progress: 'text-yellow-500',
      waiting_on_user: 'text-orange-500',
      scheduled: 'text-purple-500',
      resolved: 'text-green-500',
      closed: 'text-gray-500',
    };
    return colors[status];
  };

  const getPriorityColor = (priority: Ticket['priority']) => {
    const colors = {
      low: 'bg-slate-100 text-slate-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700',
    };
    return colors[priority];
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (email: string, username: string | null) => {
    if (username) {
      return username.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!ticket) return null;

  const StatusIcon = getStatusIcon(ticket.status);

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tickets
        </Button>
      </div>

      {/* Ticket Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">#{ticket.ticket_number}</CardTitle>
                <Badge variant="secondary" className={getPriorityColor(ticket.priority)}>
                  {ticket.priority}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <StatusIcon className={`h-3 w-3 ${getStatusColor(ticket.status)}`} />
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </div>
              <CardTitle className="text-xl font-medium">{ticket.subject}</CardTitle>
              <CardDescription className="flex items-center gap-4">
                <span>Created {formatTimestamp(ticket.created_at)}</span>
                {isAdmin && (
                  <>
                    <span>•</span>
                    <span>User: {ticket.user_email}</span>
                  </>
                )}
                {ticket.assigned_to_username && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Assigned: {ticket.assigned_to_username}
                    </span>
                  </>
                )}
              </CardDescription>
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="flex gap-2">
                <Select
                  value={ticket.priority}
                  onValueChange={updateTicketPriority}
                  disabled={updating}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={ticket.status}
                  onValueChange={updateTicketStatus}
                  disabled={updating}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting_on_user">Waiting on User</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Messages Thread */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
          <CardDescription>
            {ticket.messages.length} {ticket.messages.length === 1 ? 'message' : 'messages'}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4">
            {ticket.messages.map((message, index) => {
              const isCurrentUser = currentUserId && message.user_id === currentUserId;
              return (
                <div key={message.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className={`flex gap-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        className={message.is_internal_note ? 'bg-yellow-100' : 'bg-slate-100'}
                      >
                        {getInitials(message.user_email, message.user_username)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex-1 space-y-1 ${isCurrentUser ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 ${isCurrentUser ? 'flex-row-reverse justify-start' : ''}`}>
                        <span className="font-medium text-sm">
                          {message.user_username || message.user_email}
                        </span>
                        {message.is_internal_note && (
                          <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200">
                            Internal Note
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.created_at)}
                        </span>
                      </div>
                      <div className={`text-sm prose prose-sm max-w-none dark:prose-invert ${isCurrentUser ? 'ml-auto' : ''}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.message}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Form */}
          {ticket.status !== 'closed' && (
            <>
              <Separator className="my-8" />
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                {/* Text Formatting Toolbar */}
                <div className="flex items-center gap-1 border-b pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={sending}
                    onClick={() => handleTextFormat('**')}
                    title="Bold"
                    className="h-8 w-8 p-0"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={sending}
                    onClick={() => handleTextFormat('_')}
                    title="Italic"
                    className="h-8 w-8 p-0"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={sending}
                    onClick={() => handleTextFormat('`')}
                    title="Code"
                    className="h-8 w-8 p-0"
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={sending}
                    onClick={() => handleTextFormat('- ', '', true)}
                    title="Bullet list"
                    className="h-8 w-8 p-0"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={sending}
                    onClick={() => handleTextFormat('1. ', '', true)}
                    title="Numbered list"
                    className="h-8 w-8 p-0"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={sending}
                    onClick={() => handleTextFormat('[', '](url)')}
                    title="Link"
                    className="h-8 w-8 p-0"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>

                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    placeholder="Type your message... (Ctrl+Enter to send, supports Markdown formatting)"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={6}
                    maxLength={10000}
                    disabled={sending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute bottom-2 right-2"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    disabled={sending}
                    data-emoji-button
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </div>
                {showEmojiPicker && (
                  <div className="absolute z-50 right-0 emoji-picker-container">
                    <EmojiPicker onEmojiClick={handleEmojiClick} />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {newMessage.length} / 10,000 characters
                  </p>
                  {isAdmin && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded"
                      />
                      Internal note (admin only)
                    </label>
                  )}
                </div>
                <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                  {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  Send Message
                </Button>
              </div>
            </>
          )}

          {ticket.status === 'closed' && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This ticket is closed. Please create a new ticket if you need further assistance.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
