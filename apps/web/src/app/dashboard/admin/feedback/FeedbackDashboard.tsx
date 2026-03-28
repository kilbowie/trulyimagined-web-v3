'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Angry,
  Frown,
  Meh,
  Smile,
  Heart,
  Search,
  Filter,
  Mail,
  Check,
  Loader2,
} from 'lucide-react';

interface FeedbackItem {
  id: string;
  user_email: string;
  user_username: string;
  user_professional_name: string;
  user_role: string;
  topic: string;
  feedback_text: string;
  sentiment: string | null;
  created_at: string;
  is_read: boolean;
}

interface FeedbackStats {
  total_feedback: number;
  unread_count: number;
  unique_users: number;
  angry_count: number;
  sad_count: number;
  neutral_count: number;
  happy_count: number;
  love_count: number;
}

interface TopicBreakdown {
  topic: string;
  count: number;
  unread_count: number;
}

export default function FeedbackDashboard() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [topicBreakdown, setTopicBreakdown] = useState<TopicBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  // Reply dialog state
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const sentimentIcons = {
    angry: { icon: Angry, color: 'text-red-600', bg: 'bg-red-50', label: 'Angry' },
    sad: { icon: Frown, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Sad' },
    neutral: { icon: Meh, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Neutral' },
    happy: { icon: Smile, color: 'text-green-500', bg: 'bg-green-50', label: 'Happy' },
    love: { icon: Heart, color: 'text-pink-500', bg: 'bg-pink-50', label: 'Love' },
  };

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (selectedTopic !== 'all') params.append('topic', selectedTopic);
      if (selectedSentiment !== 'all') params.append('sentiment', selectedSentiment);
      if (unreadOnly) params.append('unread', 'true');

      const response = await fetch(`/api/feedback?${params}`);
      const data = await response.json();

      if (data.success) {
        setFeedback(data.feedback);
        setStats(data.stats);
        setTopicBreakdown(data.topicBreakdown);
      }
    } catch (error) {
      console.error('[FETCH_FEEDBACK_ERROR]', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [selectedTopic, selectedSentiment, unreadOnly]);

  const handleMarkAsRead = async (feedbackId: string) => {
    try {
      const response = await fetch(`/api/feedback/${feedbackId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_read: true }),
      });

      if (response.ok) {
        // Update local state
        setFeedback((prev) =>
          prev.map((item) => (item.id === feedbackId ? { ...item, is_read: true } : item))
        );
        // Refresh stats
        fetchFeedback();
      }
    } catch (error) {
      console.error('[MARK_AS_READ_ERROR]', error);
    }
  };

  const handleOpenReply = (item: FeedbackItem) => {
    setSelectedFeedback(item);
    setReplyMessage('');
    setReplyError(null);
    setReplyDialogOpen(true);
  };

  const handleSubmitReply = async () => {
    if (!selectedFeedback) return;

    if (replyMessage.trim().length < 10) {
      setReplyError('Reply must be at least 10 characters');
      return;
    }

    try {
      setReplySubmitting(true);
      setReplyError(null);

      const response = await fetch(`/api/feedback/${selectedFeedback.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: replyMessage.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reply');
      }

      // Close dialog and refresh
      setReplyDialogOpen(false);
      setReplyMessage('');
      setSelectedFeedback(null);
      fetchFeedback();
    } catch (error) {
      console.error('[REPLY_SUBMIT_ERROR]', error);
      setReplyError(error instanceof Error ? error.message : 'Failed to send reply');
    } finally {
      setReplySubmitting(false);
    }
  };

  const filteredFeedback = feedback.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.feedback_text.toLowerCase().includes(query) ||
      item.user_email.toLowerCase().includes(query) ||
      item.user_username?.toLowerCase().includes(query) ||
      item.topic.toLowerCase().includes(query)
    );
  });

  const getSentimentPercentage = (count: number) => {
    if (!stats || stats.total_feedback === 0) return 0;
    return ((count / stats.total_feedback) * 100).toFixed(1);
  };

  const getWidthClass = (percentage: string) => {
    const num = parseFloat(percentage);
    if (num === 0) return 'w-0';
    if (num < 10) return 'w-[8%]';
    if (num < 20) return 'w-[15%]';
    if (num < 30) return 'w-[25%]';
    if (num < 40) return 'w-[35%]';
    if (num < 50) return 'w-[45%]';
    if (num < 60) return 'w-[55%]';
    if (num < 70) return 'w-[65%]';
    if (num < 80) return 'w-[75%]';
    if (num < 90) return 'w-[85%]';
    return 'w-[95%]';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">User Feedback</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and analyze user feedback to improve the platform
        </p>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.total_feedback}</div>
              <p className="text-xs text-muted-foreground mt-1">
                From {stats.unique_users} unique users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Unread Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.unread_count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total_feedback > 0
                  ? `${((stats.unread_count / stats.total_feedback) * 100).toFixed(1)}% of total`
                  : 'No feedback yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sentiment Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-center">
                {Object.entries(sentimentIcons).map(([key, { icon: Icon, color }]) => (
                  <div key={key} className="flex flex-col items-center">
                    <Icon className={`h-5 w-5 ${color}`} />
                    <span className="text-xs font-medium mt-1">
                      {stats[`${key}_count` as keyof FeedbackStats]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Topic Breakdown */}
      {topicBreakdown && topicBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Feedback by Topic</CardTitle>
            <CardDescription>Distribution of feedback across different topics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {topicBreakdown.map((topic) => (
                <div
                  key={topic.topic}
                  className="p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="font-semibold text-sm">{topic.topic}</div>
                  <div className="text-2xl font-bold mt-1">{topic.count}</div>
                  {topic.unread_count > 0 && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {topic.unread_count} unread
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sentiment Breakdown */}
      {stats && stats.total_feedback > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Analysis</CardTitle>
            <CardDescription>User feelings about different aspects of the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(sentimentIcons).map(([key, { icon: Icon, color, bg, label }]) => {
                const count = stats[`${key}_count` as keyof FeedbackStats] as number;
                const percentage = String(getSentimentPercentage(count));

                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-sm text-muted-foreground">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${color.replace('text', 'bg')} ${getWidthClass(percentage)}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search feedback..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedTopic} onValueChange={setSelectedTopic}>
              <SelectTrigger>
                <SelectValue placeholder="All Topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                {topicBreakdown.map((topic) => (
                  <SelectItem key={topic.topic} value={topic.topic}>
                    {topic.topic} ({topic.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSentiment} onValueChange={setSelectedSentiment}>
              <SelectTrigger>
                <SelectValue placeholder="All Sentiments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sentiments</SelectItem>
                {Object.entries(sentimentIcons).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={unreadOnly ? 'default' : 'outline'}
              onClick={() => setUnreadOnly(!unreadOnly)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              {unreadOnly ? 'Showing Unread' : 'Show Unread'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Loading feedback...
            </CardContent>
          </Card>
        ) : filteredFeedback.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No feedback found matching your filters.
            </CardContent>
          </Card>
        ) : (
          filteredFeedback.map((item) => {
            const sentimentInfo = item.sentiment
              ? sentimentIcons[item.sentiment as keyof typeof sentimentIcons]
              : null;
            const SentimentIcon = sentimentInfo?.icon;

            return (
              <Card key={item.id} className={!item.is_read ? 'border-l-4 border-l-blue-500' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">
                          {item.user_professional_name || item.user_username || item.user_email}
                        </CardTitle>
                        <Badge variant="outline">{item.user_role}</Badge>
                        {!item.is_read && <Badge>New</Badge>}
                      </div>
                      <CardDescription>
                        {item.user_email} • {new Date(item.created_at).toLocaleDateString()} at{' '}
                        {new Date(item.created_at).toLocaleTimeString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{item.topic}</Badge>
                      {sentimentInfo && SentimentIcon && (
                        <div className={`p-2 rounded-lg ${sentimentInfo.bg}`}>
                          <SentimentIcon className={`h-4 w-4 ${sentimentInfo.color}`} />
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-sm">{item.feedback_text}</p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    {!item.is_read && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkAsRead(item.id)}
                        className="gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Mark as Read
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleOpenReply(item)}
                      className="gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Reply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reply to Feedback</DialogTitle>
            <DialogDescription>
              Your response will create a support ticket and notify the user via email.
            </DialogDescription>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              {/* Original Feedback */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">
                      {selectedFeedback.user_professional_name || selectedFeedback.user_username}
                    </p>
                    <p className="text-sm text-muted-foreground">{selectedFeedback.user_email}</p>
                  </div>
                  <Badge>{selectedFeedback.topic}</Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-2">{selectedFeedback.feedback_text}</p>
              </div>

              {/* Reply Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Reply</label>
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your response here..."
                  className="min-h-[150px]"
                  disabled={replySubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  This will create a support ticket titled: &quot;Feedback -{' '}
                  {selectedFeedback.topic} -{' '}
                  {new Date(selectedFeedback.created_at).toLocaleDateString()}&quot;
                </p>
              </div>

              {/* Error Message */}
              {replyError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">{replyError}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReplyDialogOpen(false);
                setReplyMessage('');
                setReplyError(null);
              }}
              disabled={replySubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReply}
              disabled={replySubmitting || replyMessage.trim().length < 10}
            >
              {replySubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {replySubmitting ? 'Sending...' : 'Send Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
