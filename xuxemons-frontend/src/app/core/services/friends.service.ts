import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import type { FriendUser, FriendRequestItem, SearchUser } from '../interfaces';

@Injectable({ providedIn: 'root' })
export class FriendsService {
    private readonly http = inject(HttpClient);
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private readonly apiUrl = this.isBrowser ? 'http://localhost:8080/api' : 'http://backend/api';

    private readonly friends$ = new BehaviorSubject<FriendUser[]>([]);
    private readonly pendingRequests$ = new BehaviorSubject<FriendRequestItem[]>([]);

    readonly friends = this.friends$.asObservable();
    readonly pendingRequests = this.pendingRequests$.asObservable();
    readonly pendingCount = this.pendingRequests$.pipe(map(r => r.length));

    loadAll(): void {
        this.loadFriends();
        this.loadPendingRequests();
    }

    loadFriends(): void {
        if (!this.isBrowser) return;
        this.http.get<{ data: FriendUser[] }>(`${this.apiUrl}/friends`)
            .subscribe({ next: r => this.friends$.next(r.data ?? []) });
    }

    loadPendingRequests(): void {
        if (!this.isBrowser) return;
        this.http.get<{ data: FriendRequestItem[] }>(`${this.apiUrl}/friends/requests`)
            .subscribe({ next: r => this.pendingRequests$.next(r.data ?? []) });
    }

    searchUsers(query: string): Observable<SearchUser[]> {
        return this.http
            .get<{ data: SearchUser[] }>(`${this.apiUrl}/friends/search`, { params: { q: query } })
            .pipe(map(r => r.data ?? []));
    }

    sendRequest(receiverId: string): Observable<{ message: string; auto_accepted?: boolean }> {
        return this.http.post<{ message: string; auto_accepted?: boolean }>(
            `${this.apiUrl}/friends/requests`,
            { receiver_id: receiverId },
        );
    }

    cancelRequest(receiverId: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/friends/requests/cancel/${encodeURIComponent(receiverId)}`);
    }

    acceptRequest(requestId: number): Observable<void> {
        return this.http.put<void>(`${this.apiUrl}/friends/requests/${requestId}/accept`, {}).pipe(
            tap(() => {
                this.pendingRequests$.next(
                    this.pendingRequests$.getValue().filter(r => r.id !== requestId),
                );
                this.loadFriends();
            }),
        );
    }

    rejectRequest(requestId: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/friends/requests/${requestId}`).pipe(
            tap(() => {
                this.pendingRequests$.next(
                    this.pendingRequests$.getValue().filter(r => r.id !== requestId),
                );
            }),
        );
    }

    removeFriend(friendId: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/friends/${encodeURIComponent(friendId)}`).pipe(
            tap(() => {
                this.friends$.next(
                    this.friends$.getValue().filter(f => f.id !== friendId),
                );
            }),
        );
    }
}
