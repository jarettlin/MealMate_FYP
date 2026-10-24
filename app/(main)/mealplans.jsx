import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image, TouchableOpacity, Alert, Modal, Button, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform } from "react-native";
import { supabase } from "../../lib/supabase";
import ScreenWrapper from "../../components/ScreenWrapper";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../../components/Avatar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const MealPlans = () => {
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('my'); // 'my', 'nearby', or 'joined'
  const { user } = useAuth();
  const [showJoinedUsers, setShowJoinedUsers] = useState(false);
  const [selectedEventUsers, setSelectedEventUsers] = useState([]);
  const [joinedUserCounts, setJoinedUserCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMealPlans, setFilteredMealPlans] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedMealPlanForReview, setSelectedMealPlanForReview] = useState(null);

  const router = useRouter();

  useEffect(() => {
    if (user) {
      fetchMealPlans();

      // Set up real-time subscription for meal plan users
      const channel = supabase
        .channel('meal_plan_users_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'meal_plan_users'
          },
          async (payload) => {
            // When a change occurs, fetch the count for that specific meal plan
            if (payload.new) {
              await fetchJoinedUsersCount(payload.new.meal_plan_id);
            }
            // Also refresh the meal plans to ensure everything is up to date
            fetchMealPlans();
          }
        )
        .subscribe();

      // Cleanup subscription
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeTab, user]);

    const fetchMealPlans = async () => {
      try {
        setLoading(true);
      setError(null);
      let query;
      const now = new Date().toISOString();

      switch (activeTab) {
        case 'my':
          query = await supabase
            .from("meal_plans")
            .select(`
              *,
              users:user_id (
                name,
                image
              ),
              meal_plan_users (
                user_id,
                users (
                  id,
                  name,
                  image
                )
              )
            `)
            .eq('user_id', user.id)
            .order("planned_at", { ascending: false });
          break;

        case 'nearby':
          query = await supabase
          .from("meal_plans")
            .select(`
              *,
              users:user_id (
                name,
                image
              ),
              meal_plan_users (
                user_id,
                users (
                  id,
                  name,
                  image
                )
              )
            `)
            .neq('user_id', user.id)
          .gt('planned_at', now)
          .order("planned_at", { ascending: true });

          if (query.error) throw query.error;

          const nearbyEvents = query.data.filter(event => {
            const userJoined = event.meal_plan_users.some(
              participant => participant.user_id === user.id
            );
            return !userJoined;
          });
          
          setMealPlans(nearbyEvents);
          setLoading(false);
          return;

        case 'joined':
          query = await supabase
            .from("meal_plans")
            .select(`
              *,
              users:user_id (
                name,
                image
              ),
              meal_plan_users!inner (
                user_id,
                users (
                  id,
                  name,
                  image
                )
              )
            `)
            .eq('meal_plan_users.user_id', user.id)
            .neq('user_id', user.id)
            .order("planned_at", { ascending: false });
          break;
      }

      if (query.error) throw query.error;
      setMealPlans(query.data || []);

      if (query.data) {
        // After fetching meal plans, get counts for each one
        query.data.forEach(mealPlan => {
          fetchJoinedUsersCount(mealPlan.id);
        });
      }
      } catch (error) {
        console.error("Error fetching meal plans:", error);
        setError(error.message);
      setMealPlans([]);
      } finally {
        setLoading(false);
      }
    };

  const handleJoinEvent = async (mealPlanId) => {
    try {
      setLoading(true);
      
      // First join the meal plan
      const { error: joinError } = await supabase
        .from("meal_plan_users")
        .insert([
          {
            meal_plan_id: mealPlanId,
            user_id: user.id,
          },
        ]);

      if (joinError) throw joinError;

      // Find the meal plan details and host info
      const { data: mealPlan, error: mealPlanError } = await supabase
        .from('meal_plans')
        .select(`
          *,
          users:user_id (
            id,
            name
          )
        `)
        .eq('id', mealPlanId)
        .single();

      if (mealPlanError) throw mealPlanError;

      // Create a notification for the host
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: mealPlan.user_id, // Send to host
          sender_id: user.id,
          type: 'JOIN',
          message: `has joined your meal plan at ${mealPlan.name}`,
          meal_plan_id: mealPlanId,
        });

      if (notifError) throw notifError;

      // Handle chat group creation/joining
      if (mealPlan) {
        const uniqueChatName = `${mealPlan.name}_${mealPlan.id}`;
        
        const { data: chat } = await supabase
          .from('chats')
          .select('id')
          .eq('chat_type', 'group')
          .eq('group_name', uniqueChatName)
          .single();

        if (chat) {
          // Add user to group_members
          const { error: groupError } = await supabase
            .from('group_members')
            .insert([
              {
                chat_id: chat.id,
                user_id: user.id
              }
            ]);

          if (groupError) throw groupError;
        }
      }

      Alert.alert("Success", "Successfully joined the meal event!");
      await fetchMealPlans();
    } catch (error) {
      console.error("Error joining meal plan:", error);
      Alert.alert("Error", "Failed to join the meal event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchJoinedUsers = async (mealPlan) => {
    try {
      const { data, error } = await supabase
        .from("meal_plan_users")
        .select(`
          user_id,
          users (
            id,
            name,
            image
          )
        `)
        .eq('meal_plan_id', mealPlan.id);

      if (error) throw error;
      
      // Filter out the host from the count
      const joinedUsers = data.filter(user => user.users.id !== mealPlan.user_id);
      setSelectedEventUsers(joinedUsers);
      setShowJoinedUsers(true);
    } catch (error) {
      console.error("Error fetching joined users:", error);
      Alert.alert("Error", "Failed to load joined users");
    }
  };

  const fetchJoinedUsersCount = async (mealPlanId) => {
    try {
      const { data, error } = await supabase
        .from("meal_plan_users")
        .select(`
          user_id,
          users (
            id,
            name,
            image
          )
        `)
        .eq('meal_plan_id', mealPlanId);

      if (error) throw error;
      
      // Filter out the host and get the count
      const count = data.length - 1; // Subtract 1 to exclude the host
      setJoinedUserCounts(prev => ({
        ...prev,
        [mealPlanId]: count
      }));
    } catch (error) {
      console.error("Error fetching joined users count:", error);
    }
  };

  const handleChatPress = async (mealPlan) => {
    try {
      // Add console log to debug
      console.log("Meal Plan Image URL:", mealPlan.image_url);
      
      // Update the chat identifier to include both name and meal plan ID
      const uniqueChatName = `${mealPlan.name}_${mealPlan.id}`;

      // First, check if a chat already exists for this meal plan
      let { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('chat_type', 'group')
        .eq('group_name', uniqueChatName)  // Use unique chat name
        .single();

      let chatId;

      if (!existingChat) {
        // Create a new chat for this meal plan
        const { data: newChat, error: createError } = await supabase
          .from('chats')
          .insert([
            {
              chat_type: 'group',
              user1: user.id,
              user2: user.id,
              group_name: uniqueChatName,  // Use unique chat name
              group_image: mealPlan.image_url,
              last_message: `Chat created for ${mealPlan.name}`
            }
          ])
          .select()
          .single();

        if (createError) throw createError;
        chatId = newChat.id;

        // After creating chat, add all participants to group_members
        const { data: participants } = await supabase
          .from('meal_plan_users')
          .select('user_id')
          .eq('meal_plan_id', mealPlan.id);

        if (participants && participants.length > 0) {
          const groupMembers = participants.map(participant => ({
            chat_id: chatId,
            user_id: participant.user_id
          }));

          const { error: membersError } = await supabase
            .from('group_members')
            .insert(groupMembers);

          if (membersError) throw membersError;
        }
      } else {
        chatId = existingChat.id;
      }

      // Navigate to the chat screen
      router.push({
        pathname: "/chatScreen",
        params: {
          chatId: chatId,
          mealPlanId: mealPlan.id,
          receiverName: `${mealPlan.name} (${new Date(mealPlan.planned_at).toLocaleDateString()})`,
          receiverImage: mealPlan.image_url || 'https://via.placeholder.com/100', // Add fallback URL
          isMealPlanChat: true,
          hostId: mealPlan.user_id
        }
      });
    } catch (error) {
      console.error("Error handling chat:", error);
      Alert.alert("Error", "Failed to open chat");
    }
  };

  const handleLeaveMealPlan = async (mealPlanId) => {
    try {
      Alert.alert(
        "Leave Meal Plan",
        "Are you sure you want to leave this meal plan? You will be removed from the group chat.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Leave",
            style: "destructive",
            onPress: async () => {
              try {
                // Remove user from meal_plan_users
                const { error: leaveError } = await supabase
                  .from("meal_plan_users")
                  .delete()
                  .eq('meal_plan_id', mealPlanId)
                  .eq('user_id', user.id);

                if (leaveError) throw leaveError;

                // Immediately update the local state to remove the meal plan
                setMealPlans(currentPlans => 
                  currentPlans.filter(plan => plan.id !== mealPlanId)
                );

                // Update the joined users count
                setJoinedUserCounts(prev => {
                  const newCounts = { ...prev };
                  delete newCounts[mealPlanId];
                  return newCounts;
                });

                // Find the chat associated with this meal plan
                const { data: chat } = await supabase
                  .from('chats')
                  .select('id')
                  .eq('chat_type', 'group')
                  .like('group_name', `%${mealPlanId}`)
                  .single();

                if (chat) {
                  // Remove user from group_members
                  const { error: chatError } = await supabase
                    .from('group_members')
                    .delete()
                    .eq('chat_id', chat.id)
                    .eq('user_id', user.id);

                  if (chatError) throw chatError;
                }

                // Create notification for the host
                const { data: mealPlan } = await supabase
                  .from('meal_plans')
                  .select('user_id, name')
                  .eq('id', mealPlanId)
                  .single();

                if (mealPlan) {
                  // Get the current user's name
                  const { data: userData } = await supabase
                    .from('users')
                    .select('name')
                    .eq('id', user.id)
                    .single();

                  const userName = userData?.name || 'A user';
                  
                  const { error: notifError } = await supabase
                    .from('notifications')
                    .insert({
                      recipient_id: mealPlan.user_id,
                      sender_id: user.id,
                      type: 'LEAVE',
                      message: `${userName} has left your meal plan at ${mealPlan.name}`,
                      meal_plan_id: mealPlanId
                    });

                  if (notifError) throw notifError;
                }

                Alert.alert("Success", "You have left the meal plan");
              } catch (error) {
                console.error("Error in leave operation:", error);
                Alert.alert("Error", "Failed to leave the meal plan. Please try again.");
                // Refresh the meal plans to ensure UI is in sync with backend
                await fetchMealPlans();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error leaving meal plan:", error);
      Alert.alert("Error", "Failed to leave the meal plan. Please try again.");
    }
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    const filtered = mealPlans.filter(plan => 
      plan.name.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredMealPlans(filtered);
  };

  const handleSubmitReview = async () => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('meal_plan_reviews')
        .insert({
          meal_plan_id: selectedMealPlanForReview.id,
          user_id: user.id,
          rating: rating,
          review_text: review,
          restaurant_name: selectedMealPlanForReview.name,
          restaurant_place_id: selectedMealPlanForReview.place_id,
          created_at: now,
          updated_at: now
        });

      if (error) throw error;

      Alert.alert('Success', 'Review submitted successfully!');
      setShowReviewModal(false);
      setRating(0);
      setReview('');
      setSelectedMealPlanForReview(null);
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review');
    }
  };

  const TabSelector = () => (
    <View style={styles.tabContainer}>
      {['my', 'nearby', 'joined'].map((tab) => (
        <TouchableOpacity 
          key={tab}
          style={[styles.tab, activeTab === tab && styles.activeTab]}
          onPress={() => setActiveTab(tab)}
        >
          <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
            {tab === 'my' ? 'My Events' : 
             tab === 'nearby' ? 'Nearby Events' : 
             'Joined Events'}
          </Text>
        </TouchableOpacity>
        
      ))}
    </View>
    
  );

  const JoinedUsersModal = ({ visible, onClose, users }) => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.joinedUsersModal}>
          <View style={styles.joinedUsersHeader}>
            <Text style={styles.joinedUsersTitle}>
              Participants ({users.length})
            </Text>
            <TouchableOpacity 
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <ScrollView 
            style={styles.joinedUsersList}
            showsVerticalScrollIndicator={false}
          >
            {users.map((user) => (
              <View key={user.user_id} style={styles.joinedUserItem}>
                <View style={styles.userAvatarContainer}>
                  <Avatar
                    uri={user.users.image}
                    size={40}
                    rounded={20}
                  />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.joinedUserName}>
                    {user.users.name}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const ReviewModal = () => (
    <Modal
      visible={showReviewModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowReviewModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.reviewModalContainer}>
          <View style={styles.reviewModalHeader}>
            <Text style={styles.reviewModalTitle}>Rate your experience</Text>
            <TouchableOpacity 
              onPress={() => setShowReviewModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
              >
                <Ionicons
                  name={rating >= star ? "star" : "star-outline"}
                  size={35}
                  color="#FFB800"
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.reviewInput}
            placeholder="Share your experience..."
            value={review}
            onChangeText={setReview}
            multiline
            maxHeight={150}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[
              styles.submitReviewButton,
              (!rating || !review) && styles.disabledButton
            ]}
            onPress={handleSubmitReview}
            disabled={!rating || !review}
          >
            <Text style={styles.submitReviewButtonText}>Submit Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderMealPlanCard = (mealPlan) => {
    const isExpired = new Date(mealPlan.planned_at) < new Date();

    return (
      <View key={mealPlan.id} style={styles.card}>
        <Image
          source={{ uri: mealPlan.image_url || "https://via.placeholder.com/100" }}
          style={styles.image}
        />
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.name} numberOfLines={1}>{mealPlan.name}</Text>
            <Text style={styles.rating}>⭐ {mealPlan.rating || "N/A"}</Text>
          </View>

          {activeTab !== 'my' && (
            <Text style={styles.hostName}>
              Hosted by {mealPlan.users?.name || 'Unknown'}
            </Text>
          )}

          <View style={styles.dateContainer}>
            <Text style={[
              styles.plannedAt,
              isExpired && styles.expiredDate
            ]}>
              {new Date(mealPlan.planned_at).toLocaleString()}
            </Text>
            {isExpired && (
              <View style={styles.expiredBadge}>
                <Text style={styles.expiredBadgeText}>Expired</Text>
              </View>
            )}
          </View>

          <Text style={styles.address} numberOfLines={2}>{mealPlan.address}</Text>
          
          <View style={styles.cardFooter}>
            <TouchableOpacity 
              style={styles.joinedUsersIndicator}
              onPress={() => fetchJoinedUsers(mealPlan)}
            >
              <Ionicons name="people-outline" size={16} color="#666" />
              <Text style={styles.joinedUsersText}>
                {joinedUserCounts[mealPlan.id] || 0} joined
              </Text>
            </TouchableOpacity>

            <View style={styles.actionButtons}>
              {activeTab === 'nearby' && !isExpired && (
                <TouchableOpacity 
                  style={styles.joinButton}
                  onPress={() => handleJoinEvent(mealPlan.id)}
                >
                  <Text style={styles.joinButtonText}>Join Event</Text>
                </TouchableOpacity>
              )}

              {activeTab === 'joined' && !isExpired && (
                <TouchableOpacity 
                  style={styles.leaveButton}
                  onPress={() => handleLeaveMealPlan(mealPlan.id)}
                >
                  <Text style={styles.leaveButtonText}>Leave</Text>
                </TouchableOpacity>
              )}

              {(activeTab === 'my' || activeTab === 'joined') && !isExpired && (
                <TouchableOpacity 
                  style={styles.chatButton}
                  onPress={() => handleChatPress(mealPlan)}
                >
                  <Ionicons name="chatbubble-outline" size={18} color="white" />
                  <Text style={styles.chatButtonText}>Chat</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {isExpired && (
            <View style={styles.reviewSection}>
              <TouchableOpacity 
                style={styles.reviewButton}
                onPress={() => {
                  setSelectedMealPlanForReview(mealPlan);
                  setShowReviewModal(true);
                }}
              >
                <Ionicons name="star-outline" size={20} color="white" />
                <Text style={styles.reviewButtonText}>Rate & Review</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <TabSelector />
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading meal plans...</Text>
      </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <TabSelector />
      
      {activeTab === 'nearby' && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for restaurant..."
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#999"
          />
          {searchQuery !== '' && (
            <TouchableOpacity 
              onPress={() => {
                setSearchQuery('');
                setFilteredMealPlans(mealPlans);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 }
        ]}
      >
        {error ? (
          <View style={styles.center}>
            <Text style={styles.error}>Error: {error}</Text>
          </View>
        ) : activeTab === 'nearby' ? (
          // Use filtered results for nearby tab
          (searchQuery ? filteredMealPlans : mealPlans).length > 0 ? (
            (searchQuery ? filteredMealPlans : mealPlans).map(renderMealPlanCard)
          ) : (
            <View style={styles.center}>
              <Text style={styles.noPlansText}>
                {searchQuery ? "No matching restaurants found" : "No nearby meal events found"}
              </Text>
            </View>
          )
        ) : mealPlans.length > 0 ? (
          mealPlans.map(renderMealPlanCard)
        ) : (
          <View style={styles.center}>
            <Text style={styles.noPlansText}>
              {activeTab === 'my' 
                ? "You haven't created any meal plans yet"
                : "You haven't joined any meal events yet"}
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.mapButton}
        onPress={() => {
          Alert.alert(
            "Create Meal Event",
            "Tap on any red marker on the map to create a meal event at that location.",
            [
              {
                text: "Got it",
                onPress: () => router.replace('/home')
              }
            ]
          );
        }}
      >
        <Ionicons name="map-outline" size={24} color="white" />
        <Text style={styles.mapButtonText}>Create Meal Event</Text>
      </TouchableOpacity>

      <JoinedUsersModal
        visible={showJoinedUsers}
        onClose={() => setShowJoinedUsers(false)}
        users={selectedEventUsers}
      />

      <ReviewModal />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f5f5f5",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    color: "red",
    fontSize: 16,
  },
  noPlansText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#666",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 15,
    marginBottom: 15,
    marginTop: 5,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  contentContainer: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1,
    marginRight: 8,
  },
  rating: {
    fontSize: 16,
    color: '#f1c40f',
    fontWeight: '600',
  },
  hostName: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
    fontWeight: '500',
  },
  address: {
    fontSize: 14,
    color: '#7f8c8d',
    marginVertical: 4,
    lineHeight: 20,
  },
  plannedAt: {
    fontSize: 14,
    color: '#2980b9',
    marginVertical: 4,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
  },
  joinedUsersIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  joinedUsersText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  joinButton: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  chatButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tab: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 15,
  },
  joinedUsersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  joinedUsersTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
    borderRadius: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 15,
  },
  joinedUsersList: {
    marginTop: 5,
  },
  joinedUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  userAvatarContainer: {
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  joinedUserName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  reviewModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  reviewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  reviewModalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingVertical: 8,
  },
  reviewInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    padding: 16,
    height: 120,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#eee',
    marginVertical: 20,
  },
  submitReviewButton: {
    backgroundColor: '#FFB800',
    padding: 16,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  submitReviewButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#FFB80080',
    shadowOpacity: 0,
    elevation: 0,
  },
  mapButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mapButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 15,
    marginTop: 5,
    paddingHorizontal: 15,
    borderRadius: 25,
    height: 45,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  reviewSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    alignItems: 'center',
  },
  reviewButton: {
    flexDirection: 'row',
    backgroundColor: '#FFB800',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewButtonText: {
    color: 'white',
    marginLeft: 8,
    fontWeight: '600',
  },
  leaveButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default MealPlans;