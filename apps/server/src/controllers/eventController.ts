import type { Request as ExpressRequest } from "express";
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Put,
  Request,
  Route,
  Security,
  SuccessResponse,
} from "tsoa";

import { getAcUserFromRequest } from "../lib/accessControl.ts";
import { BEARER_AUTH, OIDC_AUTH } from "../lib/authentication.ts";
import type {
  CreateEventInput,
  EventView,
  RenameEventInput,
  UpsertAvailabilityInput,
} from "../services/eventService.ts";
import { eventService } from "../services/eventService.ts";

@Route("events")
export class EventController extends Controller {
  @Post()
  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @SuccessResponse(201, "Created")
  async createEvent(
    @Request() req: ExpressRequest,
    @Body() body: CreateEventInput,
  ): Promise<EventView> {
    const user = await getAcUserFromRequest(req);
    const created = await eventService.create(user.id, body);
    this.setStatus(201);
    return created;
  }

  @Get("{eventId}")
  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @SuccessResponse(200)
  async getEvent(@Path() eventId: string): Promise<EventView> {
    return eventService.getById(eventId);
  }

  @Patch("{eventId}")
  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @SuccessResponse(200)
  async renameEvent(
    @Request() req: ExpressRequest,
    @Path() eventId: string,
    @Body() body: RenameEventInput,
  ): Promise<EventView> {
    const user = await getAcUserFromRequest(req);
    return eventService.rename(eventId, user.id, body);
  }

  @Delete("{eventId}")
  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @SuccessResponse(204)
  async deleteEvent(@Request() req: ExpressRequest, @Path() eventId: string): Promise<void> {
    const user = await getAcUserFromRequest(req);
    await eventService.remove(eventId, user.id);
    this.setStatus(204);
  }

  @Put("{eventId}/availability")
  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @SuccessResponse(200)
  async upsertAvailability(
    @Request() req: ExpressRequest,
    @Path() eventId: string,
    @Body() body: UpsertAvailabilityInput,
  ): Promise<EventView> {
    const user = await getAcUserFromRequest(req);
    return eventService.upsertAvailability(eventId, user.id, body);
  }

  @Delete("{eventId}/availability")
  @Security(OIDC_AUTH)
  @Security(BEARER_AUTH)
  @SuccessResponse(200)
  async withdrawAvailability(
    @Request() req: ExpressRequest,
    @Path() eventId: string,
  ): Promise<EventView> {
    const user = await getAcUserFromRequest(req);
    return eventService.withdrawAvailability(eventId, user.id);
  }
}
