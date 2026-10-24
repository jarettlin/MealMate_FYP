import React, { useState, useEffect, useRef, useCallback } from "react";
import { Alert, StyleSheet, View, Dimensions, Text, Button, Image, ScrollView, TextInput } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import { GOOGLE_API_KEY } from "@env";
import { TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { gestureHandlerRootHOC } from "react-native-gesture-handler";
import { Modal, Portal, Provider } from "react-native-paper";
import defaultRestaurantImage from "../../assets/images/default_restaurant.png";
import { supabase } from "../../lib/supabase";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import 'react-native-get-random-values';
import ScreenWrapper from "../../components/ScreenWrapper";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Avatar from "../../components/Avatar";
import { hp } from "../../helpers/commons";
import { theme } from "../../constants/themes";

// Helper functions
const extractCityAndState = (compoundCode) => {
  if (!compoundCode) return "Location Unknown";
  const parts = compoundCode.split(",");
  if (parts.length >= 2) {
    return parts.slice(1).join(",").trim();
  }
  return parts[0].trim();
};

const fetchDistance = async (origin, destination) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${GOOGLE_API_KEY}`
    );
    const data = await response.json();
    if (data.rows[0]?.elements[0]?.distance?.text) {
      return data.rows[0].elements[0].distance.text;
    }
    return "Distance unavailable";
  } catch (error) {
    console.error("Error fetching distance:", error);
    return "Distance unavailable";
  }
};

const getDistanceColor = (distance) => {
  if (!distance || distance === "Distance unavailable") return "black";
  const numericDistance = parseFloat(distance.replace(/[^0-9.]/g, ""));
  const unit = distance.includes("km") ? "km" : "m";

  if (unit === "km") {
    if (numericDistance <= 1) return "green";
    if (numericDistance <= 3) return "orange";
    return "red";
  } else {
    if (numericDistance <= 1000) return "green";
    if (numericDistance <= 3000) return "orange";
    return "red";
  }
};

const fetchPlaceDetails = async (placeId) => {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,opening_hours,rating,reviews&key=${GOOGLE_API_KEY}`
    );
    const data = await response.json();
    return {
      phoneNumber: data.result?.formatted_phone_number || "Phone number not available",
      openingHours: data.result?.opening_hours?.weekday_text || [],
      rating: data.result?.rating,
      reviews: data.result?.reviews || [],
    };
  } catch (error) {
    console.error("Error fetching place details:", error);
    return {
      phoneNumber: "Error fetching phone number",
      openingHours: [],
      rating: null,
      reviews: [],
    };
  }
};

const isDateInPast = (selectedDate) => {
  const now = new Date();
  return selectedDate < now;
};

const Home = () => {
  const [location, setLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [visible, setVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showFriendInfo, setShowFriendInfo] = useState(false);
  const mapRef = useRef(null);
  const { user, setAuth } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const autocompleteRef = useRef(null);
  const [searchRadius, setSearchRadius] = useState(5000);
  const [searchedLocations, setSearchedLocations] = useState([]);
  const [plannedAt, setPlannedAt] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [fetchedAreas, setFetchedAreas] = useState(new Set());
  const [userMealPlans, setUserMealPlans] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [selectedMealPlan, setSelectedMealPlan] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Enable location services to use this feature.");
        return;
      }

      let userLocation = await Location.getCurrentPositionAsync({});
      setLocation(userLocation.coords);

      if (user?.id) {
        await saveLocationToSupabase(user.id, userLocation.coords);
      } else {
        console.log("User not authenticated");
      }

      fetchRestaurants(userLocation.coords.latitude, userLocation.coords.longitude);
    })();
  }, []);

  const saveLocationToSupabase = async (userId, coords) => {
    if (!coords) return;
  
    const { error } = await supabase
      .from("userLocation")
      .upsert([
        {
          user_id: userId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          updated_at: new Date(),
        },
      ]);
  
    if (error) console.error("Error saving location:", error);
  };

  const fetchFriendsLocations = async () => {
    const { data, error } = await supabase    
    .from("userLocation")
    .select(`
      user_id,
      latitude,
      longitude,
      updated_at,
      users (
        name,
        email,
        bio,
        image
      )
    `)
    .neq("user_id", user.id);

    console.log("All Users' Locations:", data);

    if (error) {
      console.error("Error fetching friends' locations:", error);
      return [];
    }
  
    return data;
  };

  const [friendsLocations, setFriendsLocations] = useState([]);

  useEffect(() => {
    const fetchAndUpdateLocations = async () => {
      const locations = await fetchFriendsLocations();
      setFriendsLocations(locations);
    };

    fetchAndUpdateLocations();

    const subscription = supabase
      .channel("realtime_locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "userLocation" },
        fetchAndUpdateLocations
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const handleRegionChange = useCallback(async (region) => {
    if (!isMapReady) return;
  
    setMapRegion(region);
    const center = {
      latitude: region.latitude,
      longitude: region.longitude,
    };
  
    const areaKey = `${region.latitude.toFixed(2)},${region.longitude.toFixed(2)}`;
  
    if (!fetchedAreas.has(areaKey)) {
      const latDelta = region.latitudeDelta * 111000;
      const lngDelta = region.longitudeDelta * 111000;
      const radius = Math.max(latDelta, lngDelta) / 2;
      
      setFetchedAreas(prev => new Set([...prev, areaKey]));
      fetchRestaurants(center.latitude, center.longitude, Math.min(radius, 50000), "", true);
    }
  }, [isMapReady, fetchedAreas]);

  const fetchRestaurants = async (latitude, longitude, radius = 5000, nextPageToken = "", append = false) => {
    if (!latitude || !longitude) return;
  
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=restaurant|cafe|bar|bakery&key=${GOOGLE_API_KEY}`;
    if (nextPageToken) url += `&pagetoken=${nextPageToken}`;

    try {
      let response = await fetch(url);
      let data = await response.json();
      if (data.error_message) {
        console.error("Google API Error:", data.error_message);
        Alert.alert("Error", data.error_message);
        return;
      }
      if (data.results) {
        setRestaurants(prev => {
          const newRestaurants = data.results.filter(newRest => 
            !prev.some(existingRest => existingRest.place_id === newRest.place_id)
          );
          return [...prev, ...newRestaurants];
        });
      }
      if (data.next_page_token) {
        setTimeout(() => {
          fetchRestaurants(latitude, longitude, radius, data.next_page_token, true);
        }, 2000);
      }
    } catch (error) {
      console.error("Error fetching restaurants:", error);
    }
  };

  const searchLocation = async () => {
    if (!searchQuery) return;

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        setLocation({ latitude: lat, longitude: lng });

        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }

        fetchRestaurants(lat, lng);
      } else {
        Alert.alert("Error", "Location not found!");
      }
    } catch (error) {
      console.error("Error searching location:", error);
      Alert.alert("Error", "Failed to fetch location.");
    }
  };

  const centerMap = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  useEffect(() => {
    if (location) {
      setRestaurants([]);
      fetchRestaurants(location.latitude, location.longitude);
    }
  }, [searchRadius]);

  const handleMarkerPress = async (marker) => {
    try {
      const placeDetails = await fetchPlaceDetails(marker.place_id);
      
      // Fetch user reviews from Supabase
      const { data: userReviews, error } = await supabase
        .from('meal_plan_reviews')
        .select(`
          review_text,
          rating,
          created_at,
          users (
            name,
            image
          ),
          restaurant_place_id
        `)
        .eq('restaurant_place_id', marker.place_id);

      if (error) throw error;

      // Format user reviews
      const formattedUserReviews = (userReviews || []).map(review => ({
        author_name: review.users.name,
        rating: review.rating,
        text: review.review_text,
        time: review.created_at, // Keep as string
        user_image: review.users.image,
        isUserReview: true
      }));

      // Format Google reviews
      const formattedGoogleReviews = (placeDetails.reviews || []).map(review => ({
        ...review,
        time: new Date(review.time * 1000).toISOString(), // Convert to ISO string
        isUserReview: false
      }));

      // Combine all reviews
      const allReviews = [...formattedUserReviews, ...formattedGoogleReviews];

      // Get the photo URL
      let imageUrl = null;
      if (marker.photos && marker.photos[0]) {
        imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${marker.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
      }

      setSelectedRestaurant({
        ...marker,
        ...placeDetails,
        reviews: allReviews,
        imageUrl: imageUrl || defaultRestaurantImage
      });
      setVisible(true);
    } catch (error) {
      console.error("Error fetching place details:", error);
    }
  };

  const handleFriendMarkerPress = (friend) => {
    setSelectedFriend(friend);
    setShowFriendInfo(true);
  };

  const handleCloseFriendInfo = () => {
    setShowFriendInfo(false);
    setSelectedFriend(null);
  };

  const handleConfirm = (selectedDate) => {
    if (isDateInPast(selectedDate)) {
      Alert.alert(
        "Invalid Date",
        "❌ Invalid date and time. Please select a future date and time.",
        [
          {
            text: "OK",
            onPress: () => {
              setShowPicker(false);
              setTimeout(() => {
                setShowPicker(true);
              }, 300);
            }
          }
        ]
      );
      return;
    }
    setPlannedAt(selectedDate);
    setShowPicker(false);
  };

  const handleCreateMealPlan = async () => {
    if (isDateInPast(plannedAt)) {
      Alert.alert(
        "Invalid Date",
        "❌ Invalid date and time. Please select a future date and time.",
        [
          {
            text: "Select Again",
            onPress: () => setShowPicker(true)
          }
        ]
      );
      return;
    }

    if (!selectedRestaurant || !user?.id || !plannedAt) return;
  
    try {
      const { data: mealPlan, error: mealPlanError } = await supabase
        .from("meal_plans")
        .upsert(
          {
            place_id: selectedRestaurant.place_id,
            name: selectedRestaurant.name,
            address: selectedRestaurant.vicinity,
            phone: selectedRestaurant.phoneNumber,
            rating: typeof selectedRestaurant.rating === 'number' ? selectedRestaurant.rating : null,
            image_url: selectedRestaurant.imageUrl,
            lat: selectedRestaurant.geometry.location.lat,
            lng: selectedRestaurant.geometry.location.lng,
            user_id: user.id,
            planned_at: plannedAt.toISOString(),
          },
        )
        .select()
        .single();
  
      if (mealPlanError) throw mealPlanError;
  
      const { error: userError } = await supabase
        .from("meal_plan_users")
        .insert([
          {
            meal_plan_id: mealPlan.id,
            user_id: user.id,
          },
        ]);
  
      if (userError) throw userError;
  
      // Fetch updated meal plans immediately after creation
      await fetchUserMealPlans();
      
      Alert.alert("Success", "Meal plan created successfully!");
      setVisible(false);
    } catch (error) {
      console.error("Error creating meal plan:", error);
      Alert.alert("Error", "Failed to create meal plan.");
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchUserMealPlans();
    }
  }, [user]);

  const fetchUserMealPlans = async () => {
    try {
      // Get all user's meal plans
      const { data: myPlans, error: plansError } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('planned_at', { ascending: true });

      if (plansError) throw plansError;

      // Filter out expired meal plans
      const now = new Date();
      const activePlans = myPlans.filter(plan => new Date(plan.planned_at) > now);

      // If there's a selected friend, get their joined meal plans
      if (selectedFriend) {
        const { data: friendJoinedPlans, error: joinedError } = await supabase
          .from('meal_plan_users')
          .select('meal_plan_id')
          .eq('user_id', selectedFriend.user_id);

        if (joinedError) throw joinedError;

        // Mark plans that the friend has already joined
        const plansWithJoinStatus = activePlans.map(plan => ({
          ...plan,
          isAlreadyJoined: friendJoinedPlans.some(jp => jp.meal_plan_id === plan.id)
        }));

        setUserMealPlans(plansWithJoinStatus);
      } else {
        setUserMealPlans(activePlans);
      }
    } catch (error) {
      console.error('Error fetching meal plans:', error);
    }
  };

  const handleSendInvite = async () => {
    if (!selectedMealPlan || !selectedFriend) return;

    try {
      // First check if the user is already in this meal plan
      const { data: existingUser, error: checkError } = await supabase
        .from('meal_plan_users')
        .select('*')
        .eq('meal_plan_id', selectedMealPlan)
        .eq('user_id', selectedFriend.user_id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows returned
        throw checkError;
      }

      if (existingUser) {
        Alert.alert('Error', 'This user is already part of this meal plan.');
        return;
      }

      // Also check if there's already a pending invitation
      const { data: existingInvite, error: inviteCheckError } = await supabase
        .from('invitations')
        .select('*')
        .eq('meal_plan_id', selectedMealPlan)
        .eq('recipient_id', selectedFriend.user_id)
        .eq('status', 'pending')
        .single();

      if (inviteCheckError && inviteCheckError.code !== 'PGRST116') {
        throw inviteCheckError;
      }

      if (existingInvite) {
        Alert.alert('Error', 'You have already sent an invitation to this user for this meal plan.');
        return;
      }

      // If we get here, we can create the new invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          sender_id: user.id,
          recipient_id: selectedFriend.user_id,
          meal_plan_id: selectedMealPlan,
          message: inviteMessage,
          status: 'pending'
        })
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Create notification with invitation_id
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: selectedFriend.user_id,
          sender_id: user.id,
          type: 'INVITE',
          message: inviteMessage,
          meal_plan_id: selectedMealPlan,
          invitation_id: invitation.id
        });

      if (notifError) throw notifError;

      Alert.alert('Success', 'Invitation sent successfully!');
      setShowInviteModal(false);
      setInviteMessage('');
      setSelectedMealPlan(null);
    } catch (error) {
      console.error('Error sending invitation:', error);
      Alert.alert('Error', 'Failed to send invitation.');
    }
  };

  const renderInviteModal = () => (
    <Portal>
      <Modal
        visible={showInviteModal}
        onDismiss={() => setShowInviteModal(false)}
        contentContainerStyle={styles.inviteModalContainer}
      >
        <ScrollView>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose a Meal Event</Text>
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>
          </View>
          
          {userMealPlans.length > 0 ? (
            userMealPlans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.mealPlanItem,
                  selectedMealPlan === plan.id && styles.selectedMealPlan,
                  plan.isAlreadyJoined && styles.disabledMealPlan
                ]}
                onPress={() => !plan.isAlreadyJoined && setSelectedMealPlan(plan.id)}
                disabled={plan.isAlreadyJoined}
              >
                <View style={styles.mealPlanContent}>
                  <Text style={styles.mealPlanName}>{plan.name}</Text>
                  <Text style={styles.mealPlanDate}>
                    {new Date(plan.planned_at).toLocaleString()}
                  </Text>
                  {plan.isAlreadyJoined && (
                    <Text style={styles.alreadyJoinedText}>
                      Already joined
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.noActivePlansContainer}>
              <Text style={styles.noActivePlansText}>
                No active meal plans available
              </Text>
            </View>
          )}

          <TextInput
            style={styles.messageInput}
            placeholder="Add a message (optional)"
            value={inviteMessage}
            onChangeText={setInviteMessage}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.sendInviteButton,
              (!selectedMealPlan || userMealPlans.length === 0) && styles.disabledButton
            ]}
            onPress={handleSendInvite}
            disabled={!selectedMealPlan || userMealPlans.length === 0}
          >
            <Text style={styles.sendInviteButtonText}>Send Invitation</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </Portal>
  );

  return (
    <Provider>
      <ScreenWrapper>
        <View style={styles.container}>
          <GooglePlacesAutocomplete
            ref={autocompleteRef}
            placeholder="Search for restaurants..."
            fetchDetails
            onPress={async (data, details = null) => {
              if (details && mapRef.current) {
                const { lat, lng } = details.geometry.location;
                const newLocation = {
                  latitude: lat,
                  longitude: lng,
                  name: data.description,
                };

                setSearchedLocations((prev) => [...prev, newLocation]);

                mapRef.current.animateToRegion({
                  latitude: lat,
                  longitude: lng,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                });

                fetchRestaurants(lat, lng);
                setSearchQuery(data.description);

                const placeDetails = await fetchPlaceDetails(details.place_id);

                const selectedRestaurant = {
                  name: details.name,
                  vicinity: details.formatted_address,
                  geometry: { location: { lat, lng } },
                  place_id: details.place_id,
                  imageUrl: details.photos?.[0]?.photo_reference
                    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${details.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
                    : null,
                  phoneNumber: placeDetails.phoneNumber,
                  openingHours: placeDetails.openingHours,
                  rating: placeDetails.rating,
                  reviews: placeDetails.reviews,
                };

                setSelectedRestaurant(selectedRestaurant);
                setVisible(true);
              }
            }}
            query={{
              key: GOOGLE_API_KEY,
              language: "en",
              types: "establishment",
              location: location ? `${location.latitude},${location.longitude}` : undefined,
              radius: searchRadius,
            }}
            textInputProps={{
              value: searchQuery,
              onChangeText: setSearchQuery,
            }}
            styles={{
              container: { position: "absolute", top: 10, left: 10, right: 10, zIndex: 2 },
              textInputContainer: { backgroundColor: "white", borderRadius: 10, flexDirection: "row" },
              textInput: { height: 40, fontSize: 16, flex: 1 },
              predefinedPlacesDescription: { color: "#1faadb" },
            }}
            renderRightButton={() =>
              searchQuery ? (
                <TouchableOpacity onPress={() => { setSearchQuery(""); autocompleteRef.current?.setAddressText(""); }} style={{ padding: 10 }}>
                  <Text style={{ fontSize: 18, color: "red" }}>❌</Text>
                </TouchableOpacity>
              ) : null
            }
          />

          {location ? (
            <>
              <MapView
                ref={mapRef}
                style={styles.map}
                provider="google"
                showsUserLocation={true}
                showsMyLocationButton={false}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onMapReady={() => setIsMapReady(true)}
                onRegionChangeComplete={handleRegionChange}
              >
                <Marker
                  coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                  title="Your Location"
                  pinColor="blue"
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <View style={styles.markerContainer}>
                    <View style={styles.avatarContainer}>
                      <Avatar 
                        uri={user?.image} 
                        size={37} 
                        rounded={25}
                      />
                    </View>
                    <View style={styles.markerDot} />
                  </View>
                </Marker>
                {restaurants.map((restaurant, index) => (
                  <Marker
                    key={index}
                    coordinate={{
                      latitude: restaurant.geometry.location.lat,
                      longitude: restaurant.geometry.location.lng,
                    }}
                    onPress={() => handleMarkerPress(restaurant)}
                    pinColor="red"
                  />
                ))}

                {friendsLocations.map((friend) => (
                  <Marker
                    key={friend.user_id}
                    coordinate={{
                      latitude: friend.latitude,
                      longitude: friend.longitude,
                    }}
                    title={friend.users?.name || "Unknown"}
                    pinColor="green"
                    anchor={{ x: 0.5, y: 1 }}
                    onPress={() => handleFriendMarkerPress(friend)}
                  >
                    <View style={styles.markerContainer}>
                      <View style={styles.avatarContainer}>
                        <Avatar 
                          uri={friend.users?.image} 
                          size={37} 
                          rounded={28}
                        />
                      </View>
                      <View style={[styles.markerDot, { backgroundColor: 'green' }]} />
                    </View>
                  </Marker>
                ))}
              </MapView>

              <TouchableOpacity style={styles.locationButton} onPress={centerMap}>
                <Ionicons name="locate" size={30} color="white" />
              </TouchableOpacity>

              {showFriendInfo && selectedFriend && (
                <View style={styles.friendInfoContainer}>
                  <View style={styles.friendInfoHeader}>
                    <TouchableOpacity onPress={handleCloseFriendInfo} style={styles.closeButton}>
                      <Ionicons name="close" size={24} color="black" />
                    </TouchableOpacity>
                  </View>
                  <ScrollView>
                    <View style={styles.friendProfileContent}>
                      <View style={styles.friendAvatarContainer}>
                        <Avatar 
                          uri={selectedFriend.users?.image} 
                          size={hp(16)} 
                          rounded={theme.radius.xxl * 1.4} 
                        />
                      </View>

                      <Text style={styles.friendName}>{selectedFriend.users?.name || "Unknown"}</Text>

                      <View style={styles.friendInfoBoxes}>
                        <View style={styles.infoBox}>
                          <Text style={styles.infoHeader}>Email</Text>
                          <Text style={styles.infoText}>{selectedFriend.users?.email || "No email available"}</Text>
                        </View>

                        <View style={styles.infoBox}>
                          <Text style={styles.infoHeader}>Bio</Text>
                          <Text style={styles.infoText}>{selectedFriend.users?.bio || "No bio available"}</Text>
                        </View>

                        <View style={styles.infoBox}>
                          <Text style={styles.infoHeader}>Last Updated</Text>
                          <Text style={styles.infoText}>{new Date(selectedFriend.updated_at).toLocaleString()}</Text>
                        </View>

                        <View style={styles.infoBox}>
                          <Text style={styles.infoHeader}>Location</Text>
                          <Text style={styles.infoText}>{selectedFriend.latitude.toFixed(4)}, {selectedFriend.longitude.toFixed(4)}</Text>
                        </View>
                      </View>
                    </View>
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.inviteButton}
                    onPress={() => setShowInviteModal(true)}
                  >
                    <Text style={styles.inviteButtonText}>Invite to Meal Plan</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Portal>
                <Modal visible={visible} onDismiss={() => setVisible(false)} contentContainerStyle={styles.modalContainer}>
                  {selectedRestaurant ? (
                    <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
                      <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle} numberOfLines={3} ellipsizeMode="tail"> {selectedRestaurant.name}</Text>
                        <TouchableOpacity onPress={() => setVisible(false)}>
                          <Ionicons name="close" size={24} color="black" />
                        </TouchableOpacity>
                      </View>

                      <View>
                        <Text>Select Date and Time:</Text>
                        <TouchableOpacity 
                          onPress={() => setShowPicker(true)}
                          style={styles.datePickerButton}
                        >
                          <Text style={[
                            styles.datePickerText,
                            isDateInPast(plannedAt) && styles.invalidDate
                          ]}>
                            {plannedAt.toLocaleString()}
                          </Text>
                        </TouchableOpacity>

                        <DateTimePickerModal
                          isVisible={showPicker}
                          mode="datetime"
                          onConfirm={handleConfirm}
                          onCancel={() => setShowPicker(false)}
                          minimumDate={new Date()}
                        />
                      </View>

                      <View style={styles.modalContent}>
                        {selectedRestaurant.imageUrl?(
                          <Image
                            source={{ uri: selectedRestaurant.imageUrl }}
                            style={{ width: 150, height: 100, borderRadius: 10, marginRight: 10, marginTop: 5, resizeMode: 'cover' }}
                          />
                        ) : (
                          <Image source={defaultRestaurantImage} style={{ width: 150, height: 100, borderRadius: 10, marginHorizontal: 10,  resizeMode: 'cover' }} />
                        )}
                        <View style={styles.statusContainer}>
                          <View style={styles.detailsContainer}>
                            <Text style={{ 
                              color: selectedRestaurant.business_status === "OPERATIONAL" ? "green" : "red", 
                              fontWeight: "bold",
                              flexWrap: "wrap"
                            }}>
                              Status: {selectedRestaurant.business_status === "OPERATIONAL" ? "Open" : "Closed"}
                            </Text>
                            <Text>Distance: <Text style={{ color: selectedRestaurant.distanceColor, flexWrap: "wrap" }}> {selectedRestaurant.distance || "Unknown"} </Text></Text>
                            <Text style={{ flexShrink: 1, flexWrap: "wrap", width: "100%" }}>City: {selectedRestaurant.cityAndState || 'N/A'}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.openingHoursContainer}>
                        <Text style={styles.detailsTitle}>Opening Hours:</Text>
                        {selectedRestaurant?.openingHours?.length > 0 ? (
                          selectedRestaurant.openingHours.map((hour, index) => (
                            <Text key={index}>{hour}</Text>
                          ))
                        ) : (
                          <Text style={styles.details}>Not Available</Text>
                        )}
                      </View>

                      <View style={styles.reviewsHeader}>
                        <Text style={styles.detailsTitle}>Reviews</Text>
                        <View style={styles.reviewTypeIndicators}>
                          <View style={styles.reviewTypeIndicator}>
                            <View style={[styles.indicatorDot, { backgroundColor: '#4CAF50' }]} />
                            <Text style={styles.indicatorText}>User Reviews</Text>
                          </View>
                          <View style={styles.reviewTypeIndicator}>
                            <View style={[styles.indicatorDot, { backgroundColor: '#2196F3' }]} />
                            <Text style={styles.indicatorText}>Google Reviews</Text>
                          </View>
                        </View>
                      </View>

                      {selectedRestaurant?.reviews?.length > 0 ? (
                        selectedRestaurant.reviews.slice(0, 3).map((review, index) => {
                          const reviewDate = new Date(review.time);
                          const formattedDate = isNaN(reviewDate) ? 'Date not available' : reviewDate.toLocaleDateString();

                          return (
                            <View 
                              key={index} 
                              style={[
                                styles.reviewItem,
                                { borderLeftColor: review.isUserReview ? '#4CAF50' : '#2196F3', borderLeftWidth: 4 }
                              ]}
                            >
                              <View style={styles.reviewHeader}>
                                {review.isUserReview && review.user_image ? (
                                  <Avatar uri={review.user_image} size={30} rounded={15} />
                                ) : (
                                  <View style={styles.defaultAvatar}>
                                    <Text style={styles.avatarText}>
                                      {review.author_name?.charAt(0).toUpperCase() || '?'}
                                    </Text>
                                  </View>
                                )}
                                <Text style={styles.username}>{review.author_name}</Text>
                              </View>
                              <Text style={styles.rating}>{'⭐'.repeat(review.rating)}</Text>
                              <Text style={styles.comment}>{review.text}</Text>
                              <Text style={styles.reviewDate}>{formattedDate}</Text>
                            </View>
                          );
                        })
                      ) : (
                        <Text>No reviews available.</Text>
                      )}

                      <View style={styles.openingHoursContainer}>
                        <Text style={styles.detailsTitle}>Contact Details</Text>
                      </View>

                      <View style={styles.openingHoursContainer}>
                        <Text style={styles.details}>📞 {selectedRestaurant.phoneNumber || 'N/A' }</Text>
                        <Text style={styles.details}>🗺️ {selectedRestaurant.vicinity || 'N/A' }</Text>
                      </View>
                    </ScrollView>
                  ) : (
                    <Text>No restaurant selected</Text>
                  )}
                  <TouchableOpacity
                    style={styles.createMealPlanButton}
                    onPress={() => {
                      console.log("Create Meal Plan for:", selectedRestaurant.name);
                      handleCreateMealPlan();
                    }}
                  >
                    <Text style={styles.createMealPlanButtonText}>Create Meal Plan</Text>
                  </TouchableOpacity>
                </Modal>
              </Portal>
            </>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: "gray" }}>
                Loading map...
              </Text>
            </View>
          )}
        </View>

        {renderInviteModal()}
      </ScreenWrapper>
    </Provider>
  );
};

export default gestureHandlerRootHOC(Home);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
  locationButton: {
    position: "absolute",
    bottom: 50,
    right: 20,
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 30,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modalContainer: {
    backgroundColor: "white",
    padding: 20,
    marginHorizontal: 20,
    marginTop: 40,
    marginBottom: 40,
    borderRadius: 10,
    elevation: 5,
    flex: 1,
    justifyContent: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    flexShrink: 1,
    maxWidth: "85%",
  },
  modalContent: {
    flexDirection: "row",
    marginTop: 10,
  },
  restaurantImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginRight: 10,
    resizeMode: 'cover',
  },
  detailsContainer: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  details: {
    fontSize: 16,
    marginTop: 5,
  },
  openingHoursContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  detailsTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 5,
  },
  statusContainer: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 10,
    flex: 1, 
    width: "100%",
  },
  reviewContainer: { 
    padding: 10
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: "bold", 
    marginBottom: 5 
  },
  reviewItem: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  username: {
    fontWeight: "bold",
  },
  rating: {
    color: "gold",
  },
  comment: {
    marginTop: 5,
  },
  expandButton: {
    marginTop: 10,
    padding: 8,
    backgroundColor: "#007BFF",
    borderRadius: 5,
    alignItems: "center",
  },
  expandButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  radiusContainer: {
    position: "absolute",
    top: 60,
    right: 10,
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 20,
    padding: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    zIndex: 1
  },
  radiusButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginHorizontal: 5,
    backgroundColor: "#f0f0f0",
  },
  activeRadiusButton: {
    backgroundColor: "#007AFF",
  },
  radiusButtonText: {
    color: "#333",
    fontWeight: "bold",
  },
  activeRadiusButtonText: {
    color: "white",
  },
  createMealPlanButton: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#007AFF",
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  createMealPlanButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  datePickerContainer: {
    marginTop: 10,
    marginBottom: 10,
  },
  datePickerLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  datePickerButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginTop: 5,
  },
  datePickerText: {
    fontSize: 16,
    color: '#333',
  },
  friendInfoContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    maxHeight: '80%',
  },
  friendInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  closeButton: {
    padding: 5,
  },
  friendProfileContent: {
    alignItems: 'center',
    gap: 15,
  },
  friendAvatarContainer: {
    height: hp(16),
    width: hp(16),
    alignSelf: 'center',
    backgroundColor: '',
  },
  friendName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  friendInfoBoxes: {
    width: '100%',
    gap: 12,
  },
  infoBox: {
    backgroundColor: '#f5f5f9',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  infoHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  inviteButton: {
    backgroundColor: theme.colors.primary,
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inviteModalContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 10,
    maxHeight: '80%',
  },
  mealPlanItem: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginVertical: 5,
  },
  selectedMealPlan: {
    backgroundColor: '#e0e0e0',
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  messageInput: {
    marginTop: 15,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    height: 100,
    textAlignVertical: 'top',
  },
  sendInviteButton: {
    backgroundColor: theme.colors.primary,
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  sendInviteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  mealPlanName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  mealPlanDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  disabledMealPlan: {
    opacity: 0.6,
    backgroundColor: '#e0e0e0',
  },
  mealPlanContent: {
    flex: 1,
  },
  alreadyJoinedText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  markerContainer: {
    alignItems: 'center',
  },
  avatarContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerDot: {
    width: 10,
    height: 10,
    backgroundColor: 'blue',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  invalidDate: {
    color: 'red',
  },
  noActivePlansContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noActivePlansText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  reviewDate: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },
  reviewsHeader: {
    marginBottom: 10,
  },
  reviewTypeIndicators: {
    flexDirection: 'row',
    marginTop: 5,
    gap: 15,
  },
  reviewTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  indicatorText: {
    fontSize: 12,
    color: '#666',
  },
  defaultAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#666',
    fontWeight: 'bold',
  },
});