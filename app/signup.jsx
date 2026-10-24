import { Alert, Pressable, StyleSheet, Text, View, TextInput } from 'react-native';
import React, { useRef, useState } from 'react';
import ScreenWrapper from '../components/ScreenWrapper';
import { theme } from '../constants/themes';
import Icon from '../assets/icons';
import { StatusBar } from 'expo-status-bar';
import BackButton from '../components/BackButton';
import { useRouter } from 'expo-router';
import { hp, wp } from '../helpers/commons';
import Button from '../components/Button';
import { supabase } from '../lib/supabase';

const Signup = () => {
  const router = useRouter();
  const emailRef = useRef();
  const passwordRef = useRef();
  const nameRef = useRef();
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validateInputs = () => {
    let isValid = true;

    // Validate Name
    if (!nameRef.current || nameRef.current.trim() === "") {
      setNameError("Name is required");
      isValid = false;
    } else {
      setNameError("");
    }

    // Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRef.current || emailRef.current.trim() === "") {
      setEmailError("Email is required");
      isValid = false;
    } else if (!emailRegex.test(emailRef.current.trim())) {
      setEmailError("Invalid email format");
      isValid = false;
    } else {
      setEmailError("");
    }

    // Validate Password
    if (!passwordRef.current || passwordRef.current.trim() === "") {
      setPasswordError("Password is required");
      isValid = false;
    } else if (passwordRef.current.trim().length < 6) {
      setPasswordError("Password must be at least 6 characters");
      isValid = false;
    } else {
      setPasswordError("");
    }

    return isValid;
  };

  const onSubmit = async () => {
    if (!validateInputs()) {
      return; // Stop if validation fails
    }

    setLoading(true);

    const { data: { session }, error } = await supabase.auth.signUp({
      email: emailRef.current.trim(),
      password: passwordRef.current.trim(),
      options: {
        data: {
          name: nameRef.current.trim(),
        },
      },
    });

    setLoading(false);

    if (error) {
      Alert.alert("Sign Up", error.message);
    } else {
      Alert.alert("Sign Up", "Account created successfully!");
      //router.push("login"); // Redirect to login page
    }
  };

  return (
    <ScreenWrapper>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <BackButton router={router} />

        {/* Welcome Text */}
        <View>
          <Text style={styles.welcometxt}>Create your account</Text>
        </View>

        {/* Input Form */}
        <View style={styles.form}>
          <Text style={styles.formtxt}>Enter your details to create an account</Text>

          <Input
            icon={<Icon name="user" size={26} strokeWidth={1.6} />}
            placeholder="Enter your name"
            onChangeText={(value) => {
              nameRef.current = value;
              setNameError("");
            }}
            error={nameError}
          />

          <Input
            icon={<Icon name="email" size={26} strokeWidth={1.6} />}
            placeholder="Enter your email"
            onChangeText={(value) => {
              emailRef.current = value;
              setEmailError("");
            }}
            error={emailError}
          />

          <Input
            icon={<Icon name="password" size={26} strokeWidth={1.6} />}
            placeholder="Enter your password"
            secureTextEntry
            onChangeText={(value) => {
              passwordRef.current = value;
              setPasswordError("");
            }}
            error={passwordError}
          />

          <Button title="Sign Up" loading={loading} onPress={onSubmit} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footertxt}>Already have an account?</Text>
          <Pressable onPress={() => router.push("login")}>
            <Text style={[styles.footertxt, { color: theme.colors.primary }, { fontWeight: theme.fonts.semibold }]}>
              Login
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenWrapper>
  );
};

const Input = ({ icon, placeholder, onChangeText, secureTextEntry, error }) => {
  return (
    <View>
      <View style={styles.inputContainer}>
        {icon}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 45,
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  welcometxt: {
    textAlign: 'center',
    fontSize: hp(4),
    fontWeight: theme.fonts.semibold,
  },
  form: {
    gap: 25,
  },
  formtxt: {
    fontSize: hp(2),
    color: theme.colors.grayDark,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: hp(2),
  },
  errorText: {
    color: 'red',
    fontSize: hp(1.8),
    marginTop: 5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  footertxt: {
    fontSize: hp(2),
  },
});

export default Signup;