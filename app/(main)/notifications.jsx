import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { theme } from '../../constants/themes';
import ScreenWrapper from '../../components/ScreenWrapper';

const NotificationScreen = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [rejectionMessage, setRejectionMessage] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      subscribeToNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        sender:sender_id(name, image),
        meal_plan:meal_plan_id(*)
      `)
      .eq('recipient_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data);
  };

  const subscribeToNotifications = () => {
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        fetchNotifications
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  };

  const handleAcceptInvite = async (notification) => {
    try {
      // Update invitation status using invitation_id
      const { error: inviteError } = await supabase
        .from('invitations')
        .update({ status: 'accepted' })
        .eq('id', notification.invitation_id);

      if (inviteError) throw inviteError;

      // Add user to meal plan
      const { error: memberError } = await supabase
        .from('meal_plan_users')
        .insert({
          meal_plan_id: notification.meal_plan_id,
          user_id: user.id,
        });

      if (memberError) throw memberError;

      // Create acceptance notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: notification.sender_id,
          sender_id: user.id,
          type: 'ACCEPT',
          meal_plan_id: notification.meal_plan_id,
          invitation_id: notification.invitation_id
        });

      if (notifError) throw notifError;

      // Mark original notification as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notification.id);

      Alert.alert('Success', 'Invitation accepted!');
      fetchNotifications();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation.');
    }
  };

  const handleReject = async () => {
    if (!selectedInvitation) return;

    try {
      // Update invitation status using invitation_id
      const { error: inviteError } = await supabase
        .from('invitations')
        .update({
          status: 'rejected',
          rejection_message: rejectionMessage,
        })
        .eq('id', selectedInvitation.invitation_id);

      if (inviteError) throw inviteError;

      // Create rejection notification
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: selectedInvitation.sender_id,
          sender_id: user.id,
          type: 'REJECT',
          message: rejectionMessage,
          meal_plan_id: selectedInvitation.meal_plan_id,
          invitation_id: selectedInvitation.invitation_id
        });

      if (notifError) throw notifError;

      // Mark original notification as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', selectedInvitation.id);

      setShowRejectionInput(false);
      setRejectionMessage('');
      setSelectedInvitation(null);
      Alert.alert('Success', 'Invitation rejected');
      fetchNotifications();
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      Alert.alert('Error', 'Failed to reject invitation.');
    }
  };

  const renderNotification = (notification) => {
    const isInvite = notification.type === 'INVITE';
    const isAccept = notification.type === 'ACCEPT';
    const isReject = notification.type === 'REJECT';
    const isJoin = notification.type === 'JOIN';
    const isLeave = notification.type === 'LEAVE';

    // Convert UTC timestamp to Malaysia time (UTC+8)
    const formatTimestamp = (timestamp) => {
      const date = new Date(timestamp);
      // Add 8 hours to convert to Malaysia time
      date.setHours(date.getHours() + 8);
      return date.toLocaleString('en-MY', { 
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true // This will show time in 12-hour format with AM/PM
      });
    };

    return (
      <View style={styles.notificationItem}>
        <Text style={styles.senderName}>{notification.sender.name}</Text>
        
        {isInvite && (
          <>
            <Text style={styles.message}>
              invited you to join {notification.meal_plan.name}
            </Text>
            {notification.message && (
              <Text style={styles.inviteMessage}>"{notification.message}"</Text>
            )}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleAcceptInvite(notification)}
              >
                <Text style={styles.buttonText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => {
                  setSelectedInvitation(notification);
                  setShowRejectionInput(true);
                }}
              >
                <Text style={styles.buttonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {isAccept && (
          <Text style={styles.message}>
            accepted your invitation to {notification.meal_plan.name}
          </Text>
        )}

        {isReject && (
          <>
            <Text style={styles.message}>
              declined your invitation to {notification.meal_plan.name}
            </Text>
            {notification.message && (
              <Text style={styles.rejectMessage}>"{notification.message}"</Text>
            )}
          </>
        )}

        {isJoin && (
          <Text style={[styles.message, styles.joinMessage]}>
            {notification.message}
          </Text>
        )}

        {isLeave && (
          <Text style={[styles.message, styles.leaveMessage]}>
            {notification.message}
          </Text>
        )}

        <Text style={styles.timestamp}>
          {formatTimestamp(notification.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <FlatList
          data={notifications}
          renderItem={({ item }) => renderNotification(item)}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No new notifications</Text>
          }
        />

        {/* Rejection Modal */}
        {showRejectionInput && (
          <View style={styles.rejectionModal}>
            <TextInput
              style={styles.rejectionInput}
              placeholder="Add a rejection message (optional)"
              value={rejectionMessage}
              onChangeText={setRejectionMessage}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRejectionInput(false);
                  setRejectionMessage('');
                  setSelectedInvitation(null);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleReject}
              >
                <Text style={styles.buttonText}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
  },
  notificationItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  senderName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  message: {
    fontSize: 14,
    color: '#666',
  },
  inviteMessage: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 5,
    color: '#666',
  },
  rejectMessage: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 5,
    color: '#666',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: theme.colors.primary,
  },
  rejectButton: {
    backgroundColor: '#dc3545',
    borderWidth: 1,
    borderColor: '#dc3545',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  rejectionModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  rejectionInput: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    height: 100,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cancelButton: {
    backgroundColor: '#dc3545',
  },
  confirmButton: {
    backgroundColor: '#28a745',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  joinMessage: {
    fontSize: 14,
    color: '#27ae60',
    marginTop: 5,
    fontWeight: '500',
  },
  leaveMessage: {
    fontSize: 14,
    color: '#dc3545',
    marginTop: 5,
    fontWeight: '500',
  }
});

export default NotificationScreen;