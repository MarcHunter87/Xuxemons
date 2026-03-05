import { Injectable, signal, computed } from '@angular/core';

export interface Xuxemon {
    id: number;
    name: string;
    type: { name: string };
    image_url: string;
}

@Injectable({
    providedIn: 'root'
})
export class XuxemonService {
    public readonly xuxemonsList = signal<Xuxemon[]>([
        { id: 1, name: 'Ajarakan', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Ajarakan.png' },
        { id: 2, name: 'Arkveld', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Arkveld.png' },
        { id: 3, name: 'Blangonga', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Blangonga.png' },
        { id: 4, name: 'Chatacabra', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Chatacabra.png' },
        { id: 5, name: 'Congalala', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Congalala.png' },
        { id: 6, name: 'Doshaguma', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Doshaguma.png' },
        { id: 7, name: 'G. Anjanath', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/G. Anjanath.png' },
        { id: 8, name: 'G. Arkveld', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/G. Arkveld.png' },
        { id: 9, name: 'G. Doshaguma', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/G. Doshaguma.png' },
        { id: 10, name: 'G. Odogaron', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/G. Odogaron.png' },
        { id: 11, name: 'G. Rathalos', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/G. Rathalos.png' },
        { id: 12, name: 'Gogmazios', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Gogmazios.png' },
        { id: 13, name: 'Gore Magala', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Gore Magala.png' },
        { id: 14, name: 'Gravios', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Gravios.png' },
        { id: 15, name: 'Gypceros', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Gypceros.png' },
        { id: 16, name: 'Hirabami', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Hirabami.png' },
        { id: 17, name: 'Jin Dahaad', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Jin Dahaad.png' },
        { id: 18, name: 'Lagiacrus', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Lagiacrus.png' },
        { id: 19, name: 'Lalabarina', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Lalabarina.png' },
        { id: 20, name: 'Nerscylla', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Nerscylla.png' },
        { id: 21, name: 'Nu Udra', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Nu Udra.png' },
        { id: 22, name: 'Omega', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Omega.png' },
        { id: 23, name: 'Quematrice', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Quematrice.png' },
        { id: 24, name: 'Rathalos', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Rathalos.png' },
        { id: 25, name: 'Rathian', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Rathian.png' },
        { id: 26, name: 'Rey Dau', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Rey Dau.png' },
        { id: 27, name: 'Rompopolo', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Rompopolo.png' },
        { id: 28, name: 'Seregios', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Seregios.png' },
        { id: 29, name: 'Uth Duna', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Uth Duna.png' },
        { id: 30, name: 'Xu Wu', type: { name: 'Technical' }, image_url: 'http://localhost:8080/xuxemons/Xu Wu.png' },
        { id: 31, name: 'Yian Kut Ku', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Yian Kut Ku.png' },
        { id: 32, name: 'Zoh Shia', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Zoh Shia.png' },
    ]);

    public readonly myxuxemonsList = signal<Xuxemon[]>([
        { id: 1, name: 'Ajarakan', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/Ajarakan.png' },
        { id: 10, name: 'G. Odogaron', type: { name: 'Power' }, image_url: 'http://localhost:8080/xuxemons/G. Odogaron.png' },
        { id: 32, name: 'Zoh Shia', type: { name: 'Speed' }, image_url: 'http://localhost:8080/xuxemons/Zoh Shia.png' },
    ]);

    public readonly typeInventory = signal<string>('all');
    public readonly typeXuxemon = signal<string>('');
    public readonly searchQuery = signal<string>('');

    public readonly displayXuxemons = computed(() => {
        const typeInv = this.typeInventory();
        const typeXuxe = this.typeXuxemon();
        const query = this.searchQuery().toLowerCase();

        const baseList = typeInv === 'my' ? this.myxuxemonsList() : this.xuxemonsList();

        return baseList.filter(x => {
            const matchesType = !typeXuxe || x.type.name === typeXuxe;
            const matchesQuery = !query || x.name.toLowerCase().includes(query);
            return matchesType && matchesQuery;
        });
    });
}
