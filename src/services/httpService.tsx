import axios from "axios";
import type {
  AxiosInstance,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import toast from "react-hot-toast";
import { getTokens, storeTokens } from "@/lib/tokenManager";

const baseUrl: string = import.meta.env.VITE_APP_BASE_URL;

const httpService = (): AxiosInstance => {
  const instance: AxiosInstance = axios.create({
    baseURL: `${baseUrl}api/`,
    timeout: 2 * 60 * 60 * 1000,
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const tokens = getTokens();
      if (tokens?.token) {
        config.headers.Authorization = `Bearer ${tokens.token}`;
      }
      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    }
  );

  const handleUnauthorized = (): void => {
    localStorage.clear();
    window.location.href = "/login";
  };


  // Response interceptor
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
  
      // Optional success toast
      if (response.data?.message) {
        toast.success(response.data.message);
      }
  
      return response.data;
    },
    (error: AxiosError<any>) => {
  
      if (error.response) {
        const { status, data } = error.response;
  
        if (status === 500) {
          toast.error(data?.message || "Server Error");
          return Promise.reject(data?.message);
        }
  
        if (status === 400) {
          toast.error(data?.message || "Bad Request");
          return Promise.reject(data?.message);
        }
  
        if (status === 422) {
          toast.error(data?.message || "Validation Error");
          return Promise.reject(data?.message);
        }
  
        if (status === 401 || status === 403) {
          toast.error("Session expired. Please login again.");
          handleUnauthorized();
          return Promise.reject(data?.message);
        }
  
        if (status === 404 || status === 405) {
          toast.error("Something went wrong");
          return Promise.reject("Some Error Occurred, please try later.");
        }
      }
  
      toast.error("Network Error");
      return Promise.reject(error);
    }
  );

  return instance;
};

export default httpService();

export const setJwtToken = (token: string): void => {
  // Use same key as tokenManager
  storeTokens(token, token); // refreshToken used as same for simplicity here as per previous logic
};