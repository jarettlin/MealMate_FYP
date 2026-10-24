import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext';

const ChatList = () => {
  const [chats, setChats] = useState([]);
  const router = useRouter();
  const { user } = useAuth(); // Get logged-in user

  // Fetch chats initially
  useEffect(() => {
    const fetchChats = async () => {
      console.log('Fetching chats...');
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .or(`user1.eq.${user.id}, user2.eq.${user.id}, chat_type.eq.group`)
        .order('updated_at', { ascending: false });
  
      if (error) {
        console.error('Error fetching chats:', error);
      } else {
        setChats(data);
        console.log('Chats fetched:', data);
      }
    };
  
    fetchChats();
  
    // 🔹 Modify the real-time listener to handle both private and group chats
    const messageListener = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('New message detected:', payload.new);
          updateChatList(payload.new);
        }
      )
      .subscribe();
  
    return () => {
      console.log('Unsubscribing from messages...');
      supabase.removeChannel(messageListener);
    };
  }, []);
  

  // Function to update last message in the chat list
  const updateChatList = async (newMessage) => {
    console.log("Received new message:", newMessage);
  
    setChats((prevChats) => {
      const updatedChats = prevChats.map((chat) => {
        if (chat.id === newMessage.chat_id) {
          console.log(`Updating last message for chat ID: ${chat.id}`);
          return {
            ...chat,
            last_message: newMessage.message,
            updated_at: newMessage.created_at,
          };
        }
        return chat;
      });
  
      console.log("Updated chats list in state:", updatedChats);
      return updatedChats;
    });
  
    console.log(`Attempting to update last_message for chat ID: ${newMessage.chat_id}`);
  
    // 🔹 Ensure group chats get updated correctly
    const { error } = await supabase
      .from("chats")
      .update({
        last_message: newMessage.message,
        updated_at: newMessage.created_at,
      })
      .eq("id", newMessage.chat_id);
  
    if (error) {
      console.error("❌ Failed to update last_message in Supabase:", error);
    } else {
      console.log("✅ Successfully updated last_message in Supabase!");
    }
  };
  
  
  
  

  const goToChat = (chatId, chatType, receiverId, receiverName, receiverImage) => {
    router.push({
      pathname: '/chatScreen',
      params: { chatId, chatType, receiverId, receiverName, receiverImage }
    });
  };

  return (
    <View>
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id + item.updated_at}
        renderItem={({ item }) => {
          if (item.chat_type === 'group') {
            // Display group chat
            return (
              <TouchableOpacity onPress={() => goToChat(item.id, 'group', null, item.group_name, item.group_image)}>
                <View style={{ flexDirection: 'row', padding: 15, alignItems: 'center' }}>
                  <Image source={{ uri: item.group_image }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{item.group_name}</Text>
                    <Text style={{ color: 'gray' }}>{item.last_message || 'No messages yet'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          } else {
            // Display private chat
            const isUser1 = item.user1 === user.id;
            const receiverId = isUser1 ? item.user2 : item.user1;
            const receiverName = isUser1 ? item.user2_name : item.user1_name;
            const receiverImage = isUser1 ? item.user2_image : item.user1_image;

            return (
              <TouchableOpacity onPress={() => goToChat(item.id, 'private', receiverId, receiverName, receiverImage)}>
                <View style={{ flexDirection: 'row', padding: 15, alignItems: 'center' }}>
                  <Image source={{ uri: receiverImage }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{receiverName}</Text>
                    <Text style={{ color: 'gray' }}>{item.last_message || 'No messages yet'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }
        }}
      />
    </View>
  );
};

export default ChatList;
