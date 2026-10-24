import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);


    useEffect(() => {
        const getUser = async () => {
            const { data, error } = await supabase.auth.getUser();
            if (data?.user) {
                setUser(data.user);
            } else {
                setUser(null);
            }
        };
        getUser();
    }, []);

    const setAuth = (authUser) => {
        setUser(authUser); // This will be `null` on logout
    };

    const setUserData = (userData) => {
        setUser(userData ? { ...userData } : null); // Ensure null handling
    };

    return (
        <AuthContext.Provider value={{ user, setAuth, setUserData }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
