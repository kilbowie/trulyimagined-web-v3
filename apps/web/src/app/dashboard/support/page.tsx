'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  MessageCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  Bell,
  BellDot,
  ArrowUpDown,
  Calendar,
} from 'lucide-react';

interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting_on_user' | 'resolved' | 'closed' | 'scheduled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_at: string | null;
  user_email?: string;
  assigned_to_username?: string;
  has_unread_messages?: boolean;
}

type SortField = 'ticket_number' | 'created_at' | 'updated_at' | 'priority' | 'status';
type SortOrder = 'asc' | 'desc';

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('open');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New ticket form state
  const [newTicket, setNewTicket] = useState({
    subject: '',
    message: '',
    priority: 'medium' as const,
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/support/tickets');
      const data = await response.json();

      if (data.success) {
        setTickets(data.tickets || []);
        setIsAdmin(data.isAdmin || false);
      } else {
        setError(data.error || 'Failed to load tickets');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('[FETCH_TICKETS_ERROR]', err);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) {
      setError('Subject and message are required');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket),
      });

      const data = await response.json();

      if (data.success) {
        setIsCreateDialogOpen(false);
        setNewTicket({ subject: '', message: '', priority: 'medium' });
        fetchTickets();

        // Navigate to the new ticket
        router.push(`/dashboard/support/${data.ticket.id}`);
      } else {
        setError(data.error || 'Failed to create ticket');
      }
    } catch (err) {
      setError('Failed to create ticket');
      console.error('[CREATE_TICKET_ERROR]', err);
    } finally {
      setCreating(false);
    }
  };

  // Filter tickets by status
  const getFilteredTickets = (status: string) => {
    if (isAdmin) {
      // Admin/Agent status mapping
      const statusMap: Record<string, string[]> = {
        open: ['open', 'in_progress'],
        waiting: ['waiting_on_user'],
        scheduled: ['scheduled'],
        closed: ['resolved', 'closed'],
      };
      return tickets.filter((t) => statusMap[status]?.includes(t.status));
    } else {
      // Actor status mapping
      const statusMap: Record<string, string[]> = {
        open: ['open', 'in_progress', 'scheduled'],
        waiting: ['waiting_on_user'],
        closed: ['resolved', 'closed'],
      };
      return tickets.filter((t) => statusMap[status]?.includes(t.status));
    }
  };

  // Apply search filter
  const getSearchFilteredTickets = (ticketList: Ticket[]) => {
    if (!searchQuery) return ticketList;
    const query = searchQuery.toLowerCase();
    return ticketList.filter(
      (t) =>
        t.subject.toLowerCase().includes(query) ||
        t.ticket_number.toString().includes(query) ||
        t.user_email?.toLowerCase().includes(query) ||
        t.assigned_to_username?.toLowerCase().includes(query)
    );
  };

  // Sort tickets
  const getSortedTickets = (ticketList: Ticket[]) => {
    return [...ticketList].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Handle priority sorting with custom order
      if (sortField === 'priority') {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        aVal = priorityOrder[a.priority];
        bVal = priorityOrder[b.priority];
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Get ticket counts per tab
  const getTicketCounts = () => {
    if (isAdmin) {
      return {
        open: getFilteredTickets('open').length,
        waiting: getFilteredTickets('waiting').length,
        scheduled: getFilteredTickets('scheduled').length,
        closed: getFilteredTickets('closed').length,
      };
    } else {
      return {
        open: getFilteredTickets('open').length,
        waiting: getFilteredTickets('waiting').length,
        closed: getFilteredTickets('closed').length,
      };
    }
  };

  // Count unread notifications
  const getUnreadCount = () => {
    return tickets.filter((t) => t.has_unread_messages).length;
  };

  const getStatusBadge = (status: Ticket['status']) => {
    const styles = {
      open: { variant: 'default' as const, icon: AlertCircle, color: 'text-blue-500' },
      in_progress: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-500' },
      waiting_on_user: { variant: 'outline' as const, icon: Clock, color: 'text-orange-500' },
      scheduled: { variant: 'outline' as const, icon: Calendar, color: 'text-purple-500' },
      resolved: { variant: 'outline' as const, icon: CheckCircle2, color: 'text-green-500' },
      closed: { variant: 'outline' as const, icon: XCircle, color: 'text-gray-500' },
    };

    const style = styles[status];
    const Icon = style.icon;

    return (
      <Badge variant={style.variant} className="gap-1">
        <Icon className={`h-3 w-3 ${style.color}`} />
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: Ticket['priority']) => {
    const colors = {
      low: 'bg-slate-100 text-slate-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700',
    };

    return (
      <Badge variant="secondary" className={colors[priority]}>
        {priority}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (hours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const counts = getTicketCounts();
  const unreadCount = getUnreadCount();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Support Tickets</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? 'Manage all support requests' : 'Get help from our support team'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <BellDot className="h-3 w-3" />
              {unreadCount} new
            </Badge>
          )}
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>
                Describe your issue and we'll get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Brief description of your issue"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={newTicket.priority}
                  onValueChange={(value: any) => setNewTicket({ ...newTicket, priority: value })}
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - General question</SelectItem>
                    <SelectItem value="medium">Medium - Need help</SelectItem>
                    <SelectItem value="high">High - Issue blocking work</SelectItem>
                    <SelectItem value="critical">Critical - System down</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Provide details about your issue..."
                  value={newTicket.message}
                  onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                  rows={6}
                  maxLength={10000}
                />
                <p className="text-xs text-muted-foreground">
                  {newTicket.message.length} / 10,000 characters
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createTicket} disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ticket number, subject, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${isAdmin ? 4 : 3}, 1fr)` }}
        >
          <TabsTrigger value="open" className="gap-2">
            Open
            <Badge variant="secondary" className="rounded-full h-5 min-w-5 px-1.5">
              {counts.open}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="waiting" className="gap-2">
            Awaiting Response
            <Badge variant="secondary" className="rounded-full h-5 min-w-5 px-1.5">
              {counts.waiting}
            </Badge>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="scheduled" className="gap-2">
              Scheduled
              <Badge variant="secondary" className="rounded-full h-5 min-w-5 px-1.5">
                {counts.scheduled}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="closed" className="gap-2">
            Closed
            <Badge variant="secondary" className="rounded-full h-5 min-w-5 px-1.5">
              {counts.closed}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        {(['open', 'waiting', 'scheduled', 'closed'] as const).map((tab) => {
          if (tab === 'scheduled' && !isAdmin) return null;

          const filteredTickets = getSearchFilteredTickets(getFilteredTickets(tab));
          const sortedTickets = getSortedTickets(filteredTickets);

          return (
            <TabsContent key={tab} value={tab} className="mt-6">
              {sortedTickets.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {searchQuery ? 'No tickets found' : 'No tickets in this category'}
                    </h3>
                    <p className="text-muted-foreground text-center">
                      {searchQuery
                        ? 'Try adjusting your search query'
                        : 'Tickets will appear here when they match this status'}
                    </p>
                  </CardContent>
                </Card>
              ) : isAdmin ? (
                /* Admin/Agent Table View */
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer"
                          onClick={() => toggleSort('ticket_number')}
                        >
                          <div className="flex items-center gap-1">
                            # <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead
                          className="cursor-pointer"
                          onClick={() => toggleSort('priority')}
                        >
                          <div className="flex items-center gap-1">
                            Priority <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleSort('status')}>
                          <div className="flex items-center gap-1">
                            Status <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead
                          className="cursor-pointer"
                          onClick={() => toggleSort('created_at')}
                        >
                          <div className="flex items-center gap-1">
                            Created <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Messages</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTickets.map((ticket) => (
                        <TableRow
                          key={ticket.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/dashboard/support/${ticket.id}`)}
                        >
                          <TableCell className="font-mono">
                            <div className="flex items-center gap-2">
                              {ticket.has_unread_messages && (
                                <Bell className="h-3 w-3 text-orange-500" />
                              )}
                              #{ticket.ticket_number}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium max-w-md truncate">
                            {ticket.subject}
                          </TableCell>
                          <TableCell>{ticket.user_email}</TableCell>
                          <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                          <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                          <TableCell>{ticket.assigned_to_username || '-'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(ticket.created_at)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{ticket.message_count}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ) : (
                /* Actor Card View */
                <div className="space-y-4">
                  {sortedTickets.map((ticket) => (
                    <Card
                      key={ticket.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push(`/dashboard/support/${ticket.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              {ticket.has_unread_messages && (
                                <BellDot className="h-4 w-4 text-orange-500" />
                              )}
                              <CardTitle className="text-lg">#{ticket.ticket_number}</CardTitle>
                              {getStatusBadge(ticket.status)}
                              {getPriorityBadge(ticket.priority)}
                            </div>
                            <CardTitle className="text-base font-medium">
                              {ticket.subject}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Created {formatDate(ticket.created_at)}
                              </span>
                              {ticket.message_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3" />
                                  {ticket.message_count}{' '}
                                  {ticket.message_count === 1 ? 'message' : 'messages'}
                                </span>
                              )}
                              {ticket.last_message_at && (
                                <span className="text-xs">
                                  Last updated {formatDate(ticket.last_message_at)}
                                </span>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
