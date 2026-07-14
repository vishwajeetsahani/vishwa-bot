/**
 * container.js
 * -----------------------------------------------------------------------
 * Service Container (Vishwa Bot v2.0)
 *
 * Implements the Inversion of Control (IoC) Service Locator pattern.
 * Enables loose coupling between core features and plugins by managing
 * dependency injection dynamically.
 * -----------------------------------------------------------------------
 */

class ServiceContainer {
  constructor() {
    this.services = new Map();
  }

  /**
   * Registers a service provider.
   * @param {string} name 
   * @param {any} instance 
   */
  register(name, instance) {
    if (this.services.has(name)) {
      console.warn(`[ServiceContainer] Overwriting existing service: "${name}"`);
    }
    this.services.set(name, instance);
    console.log(`[ServiceContainer] Registered service: "${name}"`);
  }

  /**
   * Resolves a registered service provider.
   * @param {string} name 
   * @returns {any}
   */
  resolve(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`[ServiceContainer] Service not found: "${name}". Make sure it is registered on boot.`);
    }
    return service;
  }

  /**
   * Checks if a service is registered.
   * @param {string} name 
   * @returns {boolean}
   */
  has(name) {
    return this.services.has(name);
  }

  /**
   * Clears all registered services (primarily for testing purposes).
   */
  clear() {
    this.services.clear();
  }
}

module.exports = new ServiceContainer();
