import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Create spy functions that we can track across module reloads
const mockCancelTokenSource = vi.fn();
const mockCancel = vi.fn();
const mockAxiosInstanceFn = vi.fn();

// Mock axios before importing the module
vi.mock("axios", () => {
  mockAxiosInstanceFn.mockImplementation(() =>
    Promise.resolve({
      data: { success: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    })
  );

  mockCancelTokenSource.mockReturnValue({
    token: "mock-cancel-token",
    cancel: mockCancel,
  });

  return {
    default: {
      create: vi.fn(() => mockAxiosInstanceFn),
      CancelToken: {
        source: mockCancelTokenSource,
      },
    },
  };
});

describe("API Client", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstanceFn.mockImplementation(() =>
      Promise.resolve({
        data: { success: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      })
    );
    mockCancelTokenSource.mockReturnValue({
      token: "mock-cancel-token",
      cancel: mockCancel,
    });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
    vi.resetModules();
  });

  describe("axiosInstance configuration", () => {
    it("should create axios instance with default base URL when env is not set", async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      vi.resetModules();

      const axios = await import("axios");
      const { axiosInstance } = await import("../client");

      expect(axios.default.create).toHaveBeenCalledWith({
        baseURL: "http://localhost:8000",
        headers: {
          "Content-Type": "application/json",
        },
      });
      expect(axiosInstance).toBeDefined();
    });

    it("should create axios instance with custom base URL from env", async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
      vi.resetModules();

      const axios = await import("axios");
      await import("../client");

      expect(axios.default.create).toHaveBeenCalledWith({
        baseURL: "https://api.example.com",
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should set Content-Type header to application/json", async () => {
      vi.resetModules();

      const axios = await import("axios");
      await import("../client");

      expect(axios.default.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            "Content-Type": "application/json",
          },
        })
      );
    });
  });

  describe("apiClient function", () => {
    it("should make a request with the provided config", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      const config = {
        method: "GET" as const,
        url: "/test",
      };

      await apiClient(config);

      expect(mockAxiosInstanceFn).toHaveBeenCalledWith({
        ...config,
        cancelToken: "mock-cancel-token",
      });
    });

    it("should return response data directly", async () => {
      vi.resetModules();
      const mockData = { id: 1, name: "test" };

      mockAxiosInstanceFn.mockResolvedValueOnce({
        data: mockData,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      });

      const { apiClient } = await import("../client");
      const result = await apiClient<typeof mockData>({ url: "/test" });

      expect(result).toEqual(mockData);
    });

    it("should create a cancel token for each request", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      await apiClient({ url: "/test1" });
      await apiClient({ url: "/test2" });

      expect(mockCancelTokenSource).toHaveBeenCalledTimes(2);
    });

    it("should attach cancel method to the returned promise", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      const promise = apiClient({ url: "/test" });

      expect(promise).toHaveProperty("cancel");
      expect(typeof (promise as { cancel?: () => void }).cancel).toBe("function");
    });

    it("should call source.cancel when promise.cancel is invoked", async () => {
      vi.resetModules();

      // Create a delayed promise so we can call cancel before it resolves
      mockAxiosInstanceFn.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                data: { success: true },
                status: 200,
                statusText: "OK",
                headers: {},
                config: {},
              });
            }, 100);
          })
      );

      const { apiClient } = await import("../client");
      const promise = apiClient({ url: "/test" }) as Promise<unknown> & { cancel: () => void };

      promise.cancel();

      expect(mockCancel).toHaveBeenCalledWith("Query was cancelled");
    });

    it("should pass through all config options to axios", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      const config = {
        method: "POST" as const,
        url: "/api/data",
        data: { foo: "bar" },
        headers: {
          Authorization: "Bearer token123",
        },
        params: { page: 1 },
      };

      await apiClient(config);

      expect(mockAxiosInstanceFn).toHaveBeenCalledWith({
        ...config,
        cancelToken: "mock-cancel-token",
      });
    });

    it("should handle GET requests", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      await apiClient({
        method: "GET",
        url: "/users",
        params: { limit: 10 },
      });

      expect(mockAxiosInstanceFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "/users",
          params: { limit: 10 },
        })
      );
    });

    it("should handle POST requests with data", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      const postData = { name: "New User", email: "user@example.com" };

      await apiClient({
        method: "POST",
        url: "/users",
        data: postData,
      });

      expect(mockAxiosInstanceFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/users",
          data: postData,
        })
      );
    });

    it("should handle PUT requests", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      await apiClient({
        method: "PUT",
        url: "/users/1",
        data: { name: "Updated Name" },
      });

      expect(mockAxiosInstanceFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "PUT",
          url: "/users/1",
        })
      );
    });

    it("should handle DELETE requests", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      await apiClient({
        method: "DELETE",
        url: "/users/1",
      });

      expect(mockAxiosInstanceFn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "DELETE",
          url: "/users/1",
        })
      );
    });

    it("should propagate errors from axios", async () => {
      vi.resetModules();
      const axiosError = new Error("Network Error");

      mockAxiosInstanceFn.mockRejectedValueOnce(axiosError);

      const { apiClient } = await import("../client");

      await expect(apiClient({ url: "/test" })).rejects.toThrow("Network Error");
    });

    it("should handle 404 errors", async () => {
      vi.resetModules();
      const notFoundError = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: { message: "Resource not found" },
        },
      };

      mockAxiosInstanceFn.mockRejectedValueOnce(notFoundError);

      const { apiClient } = await import("../client");

      await expect(apiClient({ url: "/not-found" })).rejects.toEqual(notFoundError);
    });

    it("should handle 500 server errors", async () => {
      vi.resetModules();
      const serverError = {
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { message: "Server error" },
        },
      };

      mockAxiosInstanceFn.mockRejectedValueOnce(serverError);

      const { apiClient } = await import("../client");

      await expect(apiClient({ url: "/server-error" })).rejects.toEqual(serverError);
    });

    it("should handle timeout errors", async () => {
      vi.resetModules();
      const timeoutError = {
        code: "ECONNABORTED",
        message: "timeout of 5000ms exceeded",
      };

      mockAxiosInstanceFn.mockRejectedValueOnce(timeoutError);

      const { apiClient } = await import("../client");

      await expect(apiClient({ url: "/slow-endpoint" })).rejects.toEqual(timeoutError);
    });

    it("should handle requests with no url (edge case)", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      await apiClient({});

      expect(mockAxiosInstanceFn).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelToken: "mock-cancel-token",
        })
      );
    });
  });

  describe("default export", () => {
    it("should export apiClient as default", async () => {
      vi.resetModules();
      const module = await import("../client");

      expect(module.default).toBe(module.apiClient);
    });
  });

  describe("named exports", () => {
    it("should export axiosInstance", async () => {
      vi.resetModules();
      const { axiosInstance } = await import("../client");

      expect(axiosInstance).toBeDefined();
      expect(typeof axiosInstance).toBe("function");
    });

    it("should export apiClient", async () => {
      vi.resetModules();
      const { apiClient } = await import("../client");

      expect(apiClient).toBeDefined();
      expect(typeof apiClient).toBe("function");
    });
  });

  describe("type safety", () => {
    it("should return typed response data", async () => {
      vi.resetModules();
      interface User {
        id: number;
        name: string;
        email: string;
      }

      const mockUser: User = { id: 1, name: "John", email: "john@example.com" };
      mockAxiosInstanceFn.mockResolvedValueOnce({
        data: mockUser,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      });

      const { apiClient } = await import("../client");
      const result = await apiClient<User>({ url: "/users/1" });

      expect(result.id).toBe(1);
      expect(result.name).toBe("John");
      expect(result.email).toBe("john@example.com");
    });

    it("should handle array response types", async () => {
      vi.resetModules();
      interface Item {
        id: number;
        title: string;
      }

      const mockItems: Item[] = [
        { id: 1, title: "Item 1" },
        { id: 2, title: "Item 2" },
      ];
      mockAxiosInstanceFn.mockResolvedValueOnce({
        data: mockItems,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      });

      const { apiClient } = await import("../client");
      const result = await apiClient<Item[]>({ url: "/items" });

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Item 1");
    });

    it("should handle void response type", async () => {
      vi.resetModules();
      mockAxiosInstanceFn.mockResolvedValueOnce({
        data: undefined,
        status: 204,
        statusText: "No Content",
        headers: {},
        config: {},
      });

      const { apiClient } = await import("../client");
      const result = await apiClient<void>({ method: "DELETE", url: "/items/1" });

      expect(result).toBeUndefined();
    });

    it("should handle null response data", async () => {
      vi.resetModules();
      mockAxiosInstanceFn.mockResolvedValueOnce({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {},
      });

      const { apiClient } = await import("../client");
      const result = await apiClient<null>({ url: "/null-endpoint" });

      expect(result).toBeNull();
    });
  });
});
