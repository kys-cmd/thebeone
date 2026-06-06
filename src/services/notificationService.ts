import { supabase } from '@/lib/supabase';

export interface DBNotification {
  id: string;
  type: 'notification';
  title: string;
  content: string; // JSON holding detailed metadata
  active: boolean;
  is_deleted: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationPayload {
  userId: string; // User UUID or 'all' for global broadcast
  message: string;
  category: 'chat' | 'notice' | 'admin_message';
  link?: string;
  senderName?: string;
  readBy?: string[]; // Array of user IDs who have read this
}

export const notificationService = {
  /**
   * Create a new persistent notification in the database (support_contents table)
   */
  async createNotification(
    userId: string, // User UUID or 'all' for a global notification
    title: string,
    message: string,
    category: 'chat' | 'notice' | 'admin_message',
    link?: string,
    senderName?: string
  ): Promise<void> {
    try {
      const payload: NotificationPayload = {
        userId,
        message,
        category,
        link,
        senderName,
        readBy: []
      };

      const { error } = await supabase
        .from('support_contents')
        .insert([{
          type: 'notification',
          title: title,
          content: JSON.stringify(payload),
          active: true,
          is_deleted: false
        }]);

      if (error) {
        console.error('[NotificationService] Error creating notification:', error);
        throw error;
      }
    } catch (err) {
      console.error('[NotificationService] Unexpected creation error:', err);
    }
  },

  /**
   * Fetch all active, non-deleted notifications that belong to the current user (directly or globally)
   */
  async getNotificationsForUser(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('support_contents')
        .select('*')
        .eq('type', 'notification')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[NotificationService] Error fetching notifications:', error);
        return [];
      }

      const results: any[] = [];
      const records = data || [];

      for (const record of records) {
        try {
          const payload: NotificationPayload = JSON.parse(record.content);
          
          // Check if notice is for all, or matches this user's ID
          if (payload.userId === 'all' || payload.userId === userId) {
            const isRead = payload.readBy?.includes(userId) || false;
            
            results.push({
              id: record.id,
              title: record.title,
              message: payload.message,
              category: payload.category,
              userId: payload.userId,
              link: payload.link,
              senderName: payload.senderName,
              readBy: payload.readBy || [],
              isRead,
              created_at: record.created_at
            });
          }
        } catch (jsonErr) {
          console.warn('[NotificationService] Corrupt JSON content for notification:', record.id, jsonErr);
        }
      }

      return results;
    } catch (err) {
      console.error('[NotificationService] Unexpected fetch error:', err);
      return [];
    }
  },

  /**
   * Mark a single notification as read by updating its 'readBy' array in the DB
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      // 1. Fetch current notification
      const { data, error } = await supabase
        .from('support_contents')
        .select('*')
        .eq('id', notificationId)
        .maybeSingle();

      if (error || !data) {
        console.error('[NotificationService] Error locating notification for markAsRead:', error);
        return;
      }

      const payload: NotificationPayload = JSON.parse(data.content);
      const readBy = payload.readBy || [];

      if (!readBy.includes(userId)) {
        readBy.push(userId);
        payload.readBy = readBy;

        const { error: updateError } = await supabase
          .from('support_contents')
          .update({
            content: JSON.stringify(payload),
            updated_at: new Date().toISOString()
          })
          .eq('id', notificationId);

        if (updateError) {
          console.error('[NotificationService] Error updating notification status:', updateError);
        }
      }
    } catch (err) {
      console.error('[NotificationService] Unexpected error marking read:', err);
    }
  },

  /**
   * Mark all unread notifications for a user as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const userNotifications = await this.getNotificationsForUser(userId);
      const unread = userNotifications.filter(n => !n.isRead);

      for (const notification of unread) {
        await this.markAsRead(notification.id, userId);
      }
    } catch (err) {
      console.error('[NotificationService] Error marking all as read:', err);
    }
  },

  /**
   * Subscribe to real-time notification changes
   */
  subscribeToNotifications(onUpdate: () => void) {
    const channelName = `notification-db-changes-${Math.random().toString(36).substring(2, 7)}`;
    return supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'support_contents',
        filter: 'type=eq.notification'
      }, () => {
        onUpdate();
      })
      .subscribe();
  }
};
