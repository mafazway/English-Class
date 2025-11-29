import { useState, useEffect, useCallback, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

export type OfflineAction = {
  id: string;
  table: string;
  type: 'UPSERT' | 'DELETE' | 'INSERT'; 
  data: any;
  timestamp: number;
};

// Robust ID Generator (Safe for all browsers/contexts including http/insecure)
export const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if randomUUID fails (e.g. insecure context)
    }
  }
  // Fallback timestamp + random string
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
};

export const useOfflineSync = (supabase: SupabaseClient | null) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false); 

  // 1. Load Queue on Mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('offline_queue');
      if (stored) {
        setQueue(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load offline queue", e);
    }
  }, []);

  // 2. Network Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back Online! Syncing...", { icon: '📡', id: 'online-toast' });
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast("You are offline. Changes saved locally.", { icon: '💾', id: 'offline-toast' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 3. Process the Queue (Sync to Cloud)
  const processQueue = useCallback(async () => {
    if (!supabase || isSyncingRef.current || !navigator.onLine) return;
    
    const currentQueue: OfflineAction[] = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    if (currentQueue.length === 0) return;

    setIsSyncing(true);
    isSyncingRef.current = true;
    let successCount = 0;
    const failedItems: OfflineAction[] = [];

    for (const item of currentQueue) {
      try {
        let error;
        const tableName = item.table; 

        if (item.type === 'UPSERT') {
           const { error: err } = await supabase.from(tableName).upsert(item.data);
           error = err;
        } else if (item.type === 'DELETE') {
           const { error: err } = await supabase.from(tableName).delete().eq('id', item.data.id);
           error = err;
        } else if (item.type === 'INSERT') {
           const { error: err } = await supabase.from(tableName).insert(item.data);
           error = err;
        }

        if (error) throw error;
        successCount++;
        
      } catch (e) {
        console.error("Sync failed for item:", item, e);
        failedItems.push(item);
      }
    }

    setQueue(failedItems);
    localStorage.setItem('offline_queue', JSON.stringify(failedItems));
    
    setIsSyncing(false);
    isSyncingRef.current = false;

    if (successCount > 0) {
      toast.success(`Synced ${successCount} items to Cloud!`);
    }
  }, [supabase]);

  // 4. The Main Wrapper Function
  const syncMutation = useCallback(async (
    table: string, 
    type: 'UPSERT' | 'DELETE' | 'INSERT', 
    data: any
  ): Promise<boolean> => {
    
    // IF ONLINE: Try direct send
    if (navigator.onLine && supabase) {
      try {
        let error;
        if (type === 'UPSERT') {
           const { error: err } = await supabase.from(table).upsert(data);
           error = err;
        } else if (type === 'DELETE') {
           const { error: err } = await supabase.from(table).delete().eq('id', data.id);
           error = err;
        } else if (type === 'INSERT') {
           const { error: err } = await supabase.from(table).insert(data);
           error = err;
        }

        if (error) throw error;
        return true; 
      } catch (e) {
        console.warn("Direct cloud save failed. Fallback to queue.", e);
      }
    }

    // IF OFFLINE or ERROR: Add to Queue
    const newItem: OfflineAction = {
      id: generateId(), // Use robust ID generator
      table,
      type,
      data,
      timestamp: Date.now()
    };

    setQueue(prev => {
      const updated = [...prev, newItem];
      localStorage.setItem('offline_queue', JSON.stringify(updated));
      return updated;
    });
    
    if (!navigator.onLine) {
       toast.success("Saved to device (Pending Sync)", { icon: '📱' });
    }
    
    return true; 
  }, [supabase]);

  return { isOnline, queueSize: queue.length, isSyncing, syncMutation, processQueue };
};