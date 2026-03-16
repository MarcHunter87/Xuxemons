import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminNewItem } from './admin-new-item';

describe('AdminNewItem', () => {
  let component: AdminNewItem;
  let fixture: ComponentFixture<AdminNewItem>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNewItem]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminNewItem);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
