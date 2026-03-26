'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Send, Clock, User, Shield, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

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
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed';
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
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/support/tickets/${ticketId}`);
      const data = await response.json();

      if (data.success) {
        setTicket(data.ticket);
        setIsAdmin(data.isAdmin || false);
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
        <CardContent>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4">
            {ticket.messages.map((message, index) => (
              <div key={message.id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={message.is_internal_note ? 'bg-yellow-100' : 'bg-slate-100'}>
                      {getInitials(message.user_email, message.user_username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{message.user_username || message.user_email}</span>
                      {message.is_internal_note && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 border-yellow-200">
                          Internal Note
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Form */}
          {ticket.status !== 'closed' && (
            <>
              <Separator className="my-6" />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                    maxLength={10000}
                    disabled={sending}
                  />
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
