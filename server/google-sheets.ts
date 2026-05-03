import { google } from 'googleapis';
import { storage } from './storage';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

async function getOrCreateSpreadsheet(): Promise<string> {
  const existingId = await storage.getSetting('google_spreadsheet_id');
  
  if (existingId) {
    return existingId;
  }

  const sheets = await getUncachableGoogleSheetClient();
  
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: 'Marvel Rivals Team Schedule',
      },
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;
  
  await storage.setSetting('google_spreadsheet_id', spreadsheetId);
  
  return spreadsheetId;
}

export async function getSpreadsheetId(): Promise<string> {
  return await getOrCreateSpreadsheet();
}

export async function readScheduleFromSheet(sheetName: string) {
  try {
    const spreadsheetId = await getOrCreateSpreadsheet();
    const sheets = await getUncachableGoogleSheetClient();
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:I50`,
    });

    return response.data.values || [];
  } catch (error: any) {
    console.error('Error reading from Google Sheets:', error);
    throw new Error(`Failed to read from Google Sheets: ${error.message}`);
  }
}

export async function writeScheduleToSheet(sheetName: string, data: any[][]) {
  try {
    const spreadsheetId = await getOrCreateSpreadsheet();
    const sheets = await getUncachableGoogleSheetClient();
    
    try {
      await sheets.spreadsheets.get({
        spreadsheetId,
      });
    } catch {
      throw new Error('Cannot access spreadsheet. Please check permissions.');
    }

    const allSheets = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetExists = allSheets.data.sheets?.some(
      (sheet) => sheet.properties?.title === sheetName
    );

    let sheetId = 0;
    
    if (!sheetExists) {
      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
      sheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;
    } else {
      const sheet = allSheets.data.sheets?.find(
        (sheet) => sheet.properties?.title === sheetName
      );
      sheetId = sheet?.properties?.sheetId || 0;
    }

    // Clear existing data and data validations
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A1:Z100`,
    });

    // Clear existing data validations to avoid conflicts
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              setDataValidation: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1000,
                  startColumnIndex: 0,
                  endColumnIndex: 26,
                },
                rule: null as any,
              },
            },
          ],
        },
      });
    } catch (error) {
      // Ignore errors if there's no validation to clear
      console.log('[Google Sheets] No existing validation to clear');
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: data,
      },
    });

    // Apply beautiful formatting
    const numRows = data.length;
    // Get maximum column count across all rows to ensure all columns are formatted
    const numCols = data.length > 0 ? Math.max(...data.map(row => row?.length || 0), 9) : 9;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Auto-resize all columns
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: sheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: numCols,
              },
            },
          },
          // Format title row (row 1) - merge and center
          {
            mergeCells: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: numCols,
              },
              mergeType: 'MERGE_ALL',
            },
          },
          // Style title row - golden background with bold text
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: numCols,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 1, green: 0.85, blue: 0 }, // Golden yellow
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  textFormat: {
                    bold: true,
                    fontSize: 14,
                  },
                  borders: {
                    top: { style: 'SOLID', width: 2 },
                    bottom: { style: 'SOLID', width: 2 },
                    left: { style: 'SOLID', width: 2 },
                    right: { style: 'SOLID', width: 2 },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat,borders)',
            },
          },
          // Style header row (row 3) - golden background with bold text
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 0,
                endColumnIndex: numCols,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 1, green: 0.85, blue: 0 }, // Golden yellow
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  textFormat: {
                    bold: true,
                    fontSize: 11,
                  },
                  borders: {
                    top: { style: 'SOLID', width: 1 },
                    bottom: { style: 'SOLID', width: 1 },
                    left: { style: 'SOLID', width: 1 },
                    right: { style: 'SOLID', width: 1 },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat,borders)',
            },
          },
          // Style data rows - strong borders and center alignment
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 3,
                endRowIndex: numRows,
                startColumnIndex: 0,
                endColumnIndex: numCols,
              },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  borders: {
                    top: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                    bottom: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                    left: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                    right: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                  },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment,borders)',
            },
          },
          // Freeze header rows
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                gridProperties: {
                  frozenRowCount: 3,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          // Add data validation for availability columns (Monday-Sunday, columns C-I)
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 3, // Start from row 4 (data rows)
                endRowIndex: Math.max(numRows, 50), // Apply to current rows + extra buffer
                startColumnIndex: 2, // Column C (Monday)
                endColumnIndex: 9, // Column I (Sunday)
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: [
                    { userEnteredValue: 'unknown' },
                    { userEnteredValue: '18:00-20:00 CEST' },
                    { userEnteredValue: '20:00-22:00 CEST' },
                    { userEnteredValue: 'All blocks' },
                    { userEnteredValue: 'cannot' },
                  ],
                },
                showCustomUi: true,
                strict: true,
              },
            },
          },
          // Add data validation for Role column (column A)
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 3, // Start from row 4 (data rows)
                endRowIndex: Math.max(numRows, 50), // Apply to current rows + extra buffer
                startColumnIndex: 0, // Column A (Role)
                endColumnIndex: 1, // Column A only
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: [
                    { userEnteredValue: 'Tank' },
                    { userEnteredValue: 'DPS' },
                    { userEnteredValue: 'Support' },
                  ],
                },
                showCustomUi: true,
                strict: true,
              },
            },
          },
        ],
      },
    });

    // Add role-specific coloring to entire rows with strong borders
    const roleColors: Record<string, { red: number; green: number; blue: number }> = {
      Tank: { red: 0.678, green: 0.847, blue: 0.902 },      // Light blue #ADD8E6
      DPS: { red: 1, green: 0.753, blue: 0.796 },           // Light pink/red #FFC0CB
      Support: { red: 0.565, green: 0.933, blue: 0.565 },   // Light green #90EE90
    };

    // Apply colors to entire rows based on role with strong borders
    const colorRequests: any[] = [];
    for (let i = 3; i < numRows; i++) {
      const row = data[i];
      if (row && row[0]) {
        const role = row[0];
        const color = roleColors[role];
        if (color) {
          // Color the entire row with strong black borders
          colorRequests.push({
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: i,
                endRowIndex: i + 1,
                startColumnIndex: 0,
                endColumnIndex: numCols,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: color,
                  borders: {
                    top: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                    bottom: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                    left: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                    right: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,borders)',
            },
          });
          // Make Role column bold
          colorRequests.push({
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: i,
                endRowIndex: i + 1,
                startColumnIndex: 0,
                endColumnIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(textFormat)',
            },
          });
        }
      }
    }

    if (colorRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: colorRequests,
        },
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error writing to Google Sheets:', error);
    throw new Error(`Failed to write to Google Sheets: ${error.message}`);
  }
}

export function convertScheduleToSheetData(scheduleData: any, weekStart: string, weekEnd: string) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  const headerRow = ['Role', 'Players', ...days];
  
  // Group players by role and sort them
  const roleOrder = ["Tank", "DPS", "Support", "Analyst", "Coach"];
  const playersByRole: Record<string, any[]> = {
    Tank: [],
    DPS: [],
    Support: [],
    Analyst: [],
    Coach: [],
  };
  
  // Group players by their role
  scheduleData.players.forEach((player: any) => {
    if (playersByRole[player.role]) {
      playersByRole[player.role].push(player);
    }
  });
  
  // Create data rows in role order
  const dataRows: any[][] = [];
  roleOrder.forEach(role => {
    const players = playersByRole[role] || [];
    players.forEach((player: any) => {
      const row = [
        player.role,
        player.playerName,
        ...days.map(day => player.availability[day] || 'unknown')
      ];
      dataRows.push(row);
    });
  });

  // Get current date in format "MMM DD"
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

  return [
    [`the bootcamp Availability Times (${currentDate})`],
    [],
    headerRow,
    ...dataRows
  ];
}

export function convertSheetDataToSchedule(sheetData: any[][]) {
  if (!sheetData || sheetData.length < 4) {
    return { players: [] };
  }

  const headerIndex = 2;
  const players = [];

  for (let i = headerIndex + 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (row && row.length >= 2) {
      const player = {
        playerId: `player-${i}`,
        role: row[0] || 'Tank',
        playerName: row[1] || `Player ${i}`,
        availability: {
          Monday: row[2] || 'unknown',
          Tuesday: row[3] || 'unknown',
          Wednesday: row[4] || 'unknown',
          Thursday: row[5] || 'unknown',
          Friday: row[6] || 'unknown',
          Saturday: row[7] || 'unknown',
          Sunday: row[8] || 'unknown',
        }
      };
      players.push(player);
    }
  }

  return { players };
}
